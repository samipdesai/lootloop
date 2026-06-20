// Node-based runner for the kid-auth tests, for environments without a
// standalone Deno (the edge-runtime image ships no `deno` CLI). Mirrors the
// assertions in test.ts: it drives the served function over HTTP and verifies
// the minted JWT's HS256 signature against the project secret with Node crypto.
//
// Prereqs (see report / this dir):
//   supabase functions serve kid-auth        # in another shell
//   env: ANON_KEY, JWT_SECRET, TEST_FAMILY_ID, TEST_PROFILE_ID, TEST_PIN
//
//   node supabase/functions/kid-auth/run-tests.mjs

import crypto from "node:crypto";

const URL = process.env.FUNCTION_URL ??
  "http://127.0.0.1:54321/functions/v1/kid-auth";
const ANON_KEY = process.env.ANON_KEY ?? "";
const JWT_SECRET = process.env.JWT_SECRET ??
  "super-secret-jwt-token-with-at-least-32-characters-long";
const FAMILY_ID = process.env.TEST_FAMILY_ID;
const PROFILE_ID = process.env.TEST_PROFILE_ID;
const PIN = process.env.TEST_PIN ?? "1234";
const NONEXISTENT = "00000000-0000-4000-8000-000000000000";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    failures++;
    console.log(`  FAIL- ${name} ${extra}`);
  }
}

async function call(body, method = "POST") {
  return fetch(URL, {
    method,
    headers: {
      "content-type": "application/json",
      ...(ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function b64urlToBuf(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Verify HS256 signature and return decoded payload, or throw.
function verifyJwt(token, secret) {
  const [h, p, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest();
  const got = b64urlToBuf(sig);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    throw new Error("signature mismatch");
  }
  return {
    header: JSON.parse(b64urlToBuf(h).toString("utf8")),
    payload: JSON.parse(b64urlToBuf(p).toString("utf8")),
  };
}

async function main() {
  if (!FAMILY_ID || !PROFILE_ID) {
    console.error("Set TEST_FAMILY_ID and TEST_PROFILE_ID for the seeded kid.");
    process.exit(2);
  }

  console.log("valid PIN -> 200 + contract-exact claims + verifiable signature");
  {
    const res = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: PIN });
    check("status 200", res.status === 200, `got ${res.status}`);
    const json = await res.json();
    check("token_type bearer", json.token_type === "bearer");
    let payload, header;
    try {
      ({ payload, header } = verifyJwt(json.access_token, JWT_SECRET));
      check("HS256 signature verifies against JWT secret", true);
    } catch (e) {
      check("HS256 signature verifies against JWT secret", false, e.message);
      payload = {};
      header = {};
    }
    check("alg HS256", header.alg === "HS256");
    check("role=authenticated", payload.role === "authenticated");
    check("ll_role=kid", payload.ll_role === "kid");
    check("family_id matches", payload.family_id === FAMILY_ID);
    check("profile_id matches", payload.profile_id === PROFILE_ID);
    check("sub=profile_id", payload.sub === PROFILE_ID);
    check("aud=authenticated", payload.aud === "authenticated");
    const ttl = payload.exp - payload.iat;
    check("short-lived exp (<=30d)", ttl > 0 && ttl <= 30 * 24 * 60 * 60, `ttl=${ttl}`);

    // Strongest check: PostgREST accepts the minted token as a kid principal.
    const rest = await fetch(
      `${process.env.REST_URL ?? "http://127.0.0.1:54321/rest/v1"}/profiles?select=id,family_id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${json.access_token}` } },
    );
    const rows = await rest.json();
    check(
      "PostgREST accepts token (RLS returns only the kid's family)",
      rest.status === 200 && Array.isArray(rows) &&
        rows.every((r) => r.family_id === FAMILY_ID),
      `status ${rest.status} body ${JSON.stringify(rows).slice(0, 200)}`,
    );
  }

  console.log("invalid PIN -> generic 401");
  {
    const res = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "0000" });
    check("status 401", res.status === 401, `got ${res.status}`);
    check("error invalid_credentials", (await res.json()).error === "invalid_credentials");
  }

  console.log("nonexistent kid -> IDENTICAL generic 401");
  {
    const bad = await call({ family_id: FAMILY_ID, profile_id: NONEXISTENT, pin: PIN });
    const wrongPin = await call({ family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "0000" });
    const badStatus = bad.status, wpStatus = wrongPin.status;
    const badBody = await bad.text(), wpBody = await wrongPin.text();
    check("status 401", badStatus === 401, `got ${badStatus}`);
    check(
      "byte-identical to wrong-PIN response (no existence leak)",
      badStatus === wpStatus && badBody === wpBody,
      `${badBody} vs ${wpBody}`,
    );
  }

  console.log("malformed input -> 400");
  for (
    const body of [
      {},
      { family_id: FAMILY_ID, profile_id: PROFILE_ID },
      { family_id: "not-a-uuid", profile_id: PROFILE_ID, pin: PIN },
      { family_id: FAMILY_ID, profile_id: PROFILE_ID, pin: "" },
    ]
  ) {
    const res = await call(body);
    check(`400 for ${JSON.stringify(body)}`, res.status === 400, `got ${res.status}`);
  }

  console.log("non-POST -> 405");
  {
    const res = await call(undefined, "GET");
    check("status 405", res.status === 405, `got ${res.status}`);
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
