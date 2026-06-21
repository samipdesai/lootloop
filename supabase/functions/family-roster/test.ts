// Integration tests for the family-roster Edge Function (task #9, pre-auth step).
//
// These drive the function over HTTP (so it runs in the real Supabase edge
// runtime, against the local stack) and assert:
//   * valid code        -> 200 with EXACTLY that family's kids, correct fields,
//                          ordered by display_name (no other family's kids);
//   * lowercase code     -> still matches (case-insensitive);
//   * unknown code       -> generic 404;
//   * GET                -> 405;
//   * missing/empty code -> 400.
//
// (Rate-limit assertion lives in run-tests.mjs, which also self-seeds the
//  fixtures. This file expects fixtures supplied via env.)
//
// Run:
//   1. supabase functions serve family-roster --no-verify-jwt   (separate shell)
//   2. seed a family with kids (see run-tests.mjs) and set:
//        FUNCTION_URL  default http://127.0.0.1:54321/functions/v1/family-roster
//        ANON_KEY      a stack anon key (gateway bearer; omit with --no-verify-jwt)
//        TEST_FAMILY_ID / TEST_FAMILY_NAME / TEST_CODE   the seeded family
//        TEST_KID_NAMES  comma-separated expected names in display_name order
//   3. deno test --allow-net --allow-env supabase/functions/family-roster/test.ts
//
// (In environments without a standalone Deno, run-tests.mjs performs the same
//  assertions via Node and is what was used to verify locally.)

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTION_URL = Deno.env.get("FUNCTION_URL") ??
  "http://127.0.0.1:54321/functions/v1/family-roster";
const ANON_KEY = Deno.env.get("ANON_KEY") ?? "";
const FAMILY_ID = Deno.env.get("TEST_FAMILY_ID") ?? "";
const FAMILY_NAME = Deno.env.get("TEST_FAMILY_NAME") ?? "";
const CODE = Deno.env.get("TEST_CODE") ?? "";
const KID_NAMES = (Deno.env.get("TEST_KID_NAMES") ?? "").split(",").filter(Boolean);

// Valid-alphabet, astronomically unlikely to be a live code.
const UNKNOWN_CODE = "ZZZZZZZZ";

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

Deno.test("valid code -> 200 with exactly that family's kids, ordered", async () => {
  const res = await call({ code: CODE });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.family_id, FAMILY_ID);
  assertEquals(json.family_name, FAMILY_NAME);
  const names = (json.kids as Array<{ display_name: string }>).map((k) => k.display_name);
  assertEquals(names, KID_NAMES); // exact set + order
  for (const k of json.kids) {
    assertEquals(typeof k.profile_id, "string");
    assertEquals(typeof k.age_mode, "string");
  }
});

Deno.test("lowercase code -> still matches", async () => {
  const res = await call({ code: CODE.toLowerCase() });
  assertEquals(res.status, 200);
  assertEquals((await res.json()).family_id, FAMILY_ID);
});

Deno.test("unknown code -> generic 404", async () => {
  const res = await call({ code: UNKNOWN_CODE });
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, "not_found");
});

Deno.test("non-POST -> 405", async () => {
  const res = await call(undefined, "GET");
  assertEquals(res.status, 405);
});

Deno.test("missing/empty code -> 400", async () => {
  for (const body of [{}, { code: "" }, { code: "   " }, { code: 123 }]) {
    const res = await call(body);
    assertEquals(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assertEquals((await res.json()).error, "invalid_request");
  }
});
