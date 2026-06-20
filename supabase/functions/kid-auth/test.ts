// Integration tests for the kid-auth Edge Function (task #9).
//
// These drive the function over HTTP (so bcrypt + jose run in the real Supabase
// edge runtime) and assert:
//   * valid PIN  -> 200, JWT whose claims EXACTLY match migration 002's contract
//                   and whose HS256 signature verifies against the project secret;
//   * invalid PIN      -> generic 401;
//   * nonexistent kid  -> IDENTICAL generic 401 (no existence leak);
//   * malformed input  -> 400.
//
// Run:
//   1. supabase functions serve kid-auth     (separate shell)
//   2. seed a kid (see run-tests.mjs / README in this dir for the SQL) and set:
//        FUNCTION_URL   default http://127.0.0.1:54321/functions/v1/kid-auth
//        ANON_KEY       a stack anon key (Authorization bearer for the gateway)
//        JWT_SECRET     the project JWT secret (to verify the minted signature)
//        TEST_FAMILY_ID / TEST_PROFILE_ID / TEST_PIN  the seeded kid
//   3. deno test --allow-net --allow-env supabase/functions/kid-auth/test.ts
//
// (In environments without a standalone Deno, run-tests.mjs performs the same
//  assertions via Node and is what was used to verify locally.)

import { assertEquals } from "jsr:@std/assert@1";
import { jwtVerify } from "npm:jose@5.9.6";

const FUNCTION_URL = Deno.env.get("FUNCTION_URL") ??
  "http://127.0.0.1:54321/functions/v1/kid-auth";
const ANON_KEY = Deno.env.get("ANON_KEY") ?? "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") ??
  "super-secret-jwt-token-with-at-least-32-characters-long";
const FAMILY_ID = Deno.env.get("TEST_FAMILY_ID") ?? "";
const PROFILE_ID = Deno.env.get("TEST_PROFILE_ID") ?? "";
const PIN = Deno.env.get("TEST_PIN") ?? "1234";

const NONEXISTENT_PROFILE = "00000000-0000-4000-8000-000000000000";

async function call(body: unknown, method = "POST"): Promise<Response> {
  return await fetch(FUNCTION_URL, {
    method,
    headers: {
      "content-type": "application/json",
      ...(ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

Deno.test("valid PIN -> 200 with contract-exact claims and verifiable signature", async () => {
  const res = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: PIN });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.token_type, "bearer");

  const secret = new TextEncoder().encode(JWT_SECRET);
  // jwtVerify throws if the HS256 signature does not verify against the secret.
  const { payload, protectedHeader } = await jwtVerify(json.access_token, secret, {
    audience: "authenticated",
  });

  assertEquals(protectedHeader.alg, "HS256");
  // EXACT claim contract from migration 002.
  assertEquals(payload.role, "authenticated");
  assertEquals(payload.ll_role, "kid");
  assertEquals(payload.family_id, FAMILY_ID);
  assertEquals(payload.profile_id, PROFILE_ID);
  assertEquals(payload.sub, PROFILE_ID);
  assertEquals(payload.aud, "authenticated");
  // short-lived
  const ttl = (payload.exp as number) - (payload.iat as number);
  assertEquals(ttl > 0 && ttl <= 30 * 24 * 60 * 60, true);
});

Deno.test("invalid PIN -> generic 401", async () => {
  const res = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "0000" });
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "invalid_credentials");
});

Deno.test("nonexistent kid -> identical generic 401", async () => {
  const bad = await call({ family_id: FAMILY_ID, profile_id: NONEXISTENT_PROFILE, pin: PIN });
  const wrongPin = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "0000" });
  assertEquals(bad.status, 401);
  // Byte-identical body to the wrong-PIN case -> no existence leak.
  assertEquals(await bad.text(), await wrongPin.text());
});

Deno.test("malformed input -> 400", async () => {
  for (
    const body of [
      {},
      { family_id: FAMILY_ID, profile_id: PROFILE_ID }, // missing pin
      { family_id: "not-a-uuid", profile_id: PROFILE_ID, pin: PIN },
      { family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "" },
    ]
  ) {
    const res = await call(body);
    assertEquals(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assertEquals((await res.json()).error, "invalid_request");
  }
});

Deno.test("non-POST -> 405", async () => {
  const res = await call(undefined, "GET");
  assertEquals(res.status, 405);
});
