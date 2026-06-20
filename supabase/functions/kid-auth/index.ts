// kid-auth Edge Function (task #9, server side).
//
// A kid logs in with a PIN. This function verifies the PIN against
// profiles.pin_hash and, on success, mints a short-lived HS256 JWT carrying the
// custom LootLoop claims that the database's RLS helpers (migration 002) read.
//
// Kids are NOT auth.users rows; there is no GoTrue session for them. This
// function is the trust boundary: it checks the PIN, then signs a token the rest
// of the stack (PostgREST) accepts as a kid principal. Nothing downstream
// re-checks the PIN — the DB trusts the signature on the claims.
//
// ============================================================================
// REQUEST / RESPONSE CONTRACT
// ============================================================================
//   POST  (JSON body)
//     { "family_id": "<uuid>", "profile_id": "<uuid>", "pin": "<string>" }
//
//   The kid-login screen lists the family's kids (a public-ish roster the device
//   already has) and the kid taps theirs, so identifying by profile_id is fine.
//   family_id is required so a profile_id is only ever resolved within its
//   family (defence in depth — a profile_id leaked from another family won't
//   resolve unless family_id also matches).
//
//   200 -> { "access_token": "<jwt>", "token_type": "bearer", "expires_in": <s>,
//            "profile": { "id", "family_id", "display_name", "avatar_url", "age_mode" } }
//   400 -> { "error": "invalid_request", "message": ... }   malformed input
//   401 -> { "error": "invalid_credentials", "message": ... } bad PIN OR no such
//           kid — IDENTICAL response for both (no user-existence leak)
//   405 -> { "error": "method_not_allowed" }
//   500 -> { "error": "server_error" }                       never a stack trace
//
// ============================================================================
// PIN HASHING SCHEME  (CONTRACT with task #8 — "parent adds a kid")
// ============================================================================
//   Algorithm: bcrypt (modular-crypt format, e.g. "$2a$10$...."), cost 10.
//   Library here: npm:bcryptjs@2.4.3 — pure-JS, runs in the Supabase edge
//   runtime. The hash format is the STANDARD bcrypt MCF, so task #8 may produce
//   profiles.pin_hash with ANY compatible bcrypt implementation, including:
//       * npm:bcryptjs (same lib, recommended for symmetry), OR
//       * Postgres pgcrypto: crypt(pin, gen_salt('bf', 10))
//   bcryptjs.compare() verifies all of these. The ONLY hard requirements for #8:
//       - hash the PIN with bcrypt at cost 10 (no peppering, no extra encoding),
//       - store the full MCF string in profiles.pin_hash.
//   PIN is treated as a UTF-8 string exactly as submitted (no trimming/padding).
//   NOTE: bcrypt silently truncates inputs >72 bytes; PINs are short so this is
//   moot, but #8 should reject overlong PINs at input validation anyway.
// ============================================================================
//
// SECURITY: the PIN and the signing secret are NEVER logged. Invalid PIN and
// nonexistent kid return the exact same 401 so callers can't enumerate kids.

import postgres from "npm:postgres@3.4.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import { SignJWT } from "npm:jose@5.9.6";

// Kid sessions are short-lived. 30 days is the contract's stated maximum; we use
// it so kids aren't re-prompted constantly on a shared family device.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// The generic auth failure. MUST be byte-identical for "bad PIN" and "no such
// kid" so the endpoint can't be used to discover which profile_ids exist.
const INVALID_CREDENTIALS = {
  error: "invalid_credentials",
  message: "Incorrect PIN.",
} as const;

/**
 * Resolve the HS256 signing key the rest of the stack verifies against.
 *
 * Priority:
 *   1. SUPABASE_JWT_SECRET — set this as a function secret in deployed envs
 *      (`supabase secrets set SUPABASE_JWT_SECRET=...`). Explicit and obvious.
 *   2. The symmetric ("oct") key inside SUPABASE_JWKS — the local `supabase`
 *      stack injects SUPABASE_JWKS (NOT SUPABASE_JWT_SECRET) and its legacy
 *      HS256 key is the project JWT secret PostgREST still accepts. This lets
 *      the function work locally with zero extra config.
 *
 * Never hardcoded; never logged.
 */
function getJwtSecret(): Uint8Array {
  const explicit = Deno.env.get("SUPABASE_JWT_SECRET");
  if (explicit && explicit.length > 0) {
    return new TextEncoder().encode(explicit);
  }

  const jwksRaw = Deno.env.get("SUPABASE_JWKS");
  if (jwksRaw) {
    try {
      const jwks = JSON.parse(jwksRaw) as { keys?: Array<Record<string, unknown>> };
      const oct = jwks.keys?.find((k) => k.kty === "oct" && typeof k.k === "string");
      if (oct && typeof oct.k === "string") {
        return base64UrlDecode(oct.k);
      }
    } catch {
      // fall through to the throw below
    }
  }

  throw new Error("jwt_secret_unavailable");
}

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface KidAuthInput {
  family_id: string;
  profile_id: string;
  pin: string;
}

// Returns a typed input or null (caller -> 400). Strict: rejects missing fields,
// wrong types, non-uuid ids, empty/oversized pin.
function parseInput(body: unknown): KidAuthInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { family_id, profile_id, pin } = body as Record<string, unknown>;
  if (typeof family_id !== "string" || !UUID_RE.test(family_id)) return null;
  if (typeof profile_id !== "string" || !UUID_RE.test(profile_id)) return null;
  if (typeof pin !== "string" || pin.length < 1 || pin.length > 72) return null;
  return { family_id, profile_id, pin };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let parsed: KidAuthInput | null;
  try {
    parsed = parseInput(await req.json());
  } catch {
    parsed = null; // not JSON
  }
  if (!parsed) {
    return json(
      { error: "invalid_request", message: "Expected { family_id, profile_id, pin }." },
      400,
    );
  }

  let secret: Uint8Array;
  try {
    secret = getJwtSecret();
  } catch {
    // Misconfiguration, not the caller's fault. Don't leak why.
    return json({ error: "server_error" }, 500);
  }

  // The kid is not yet authenticated, so we read profiles directly over a
  // privileged Postgres connection (SUPABASE_DB_URL, injected by the runtime) —
  // this function IS the auth gate. We deliberately do NOT go through PostgREST
  // with the service-role key here: the app tables grant DML only to the
  // `authenticated` role (migration 002), so a service-role PostgREST read hits
  // "permission denied". A direct DB connection sidesteps that without widening
  // any table grants the db-architect owns.
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return json({ error: "server_error" }, 500);
  }

  let kid:
    | {
      id: string;
      family_id: string;
      display_name: string;
      avatar_url: string | null;
      age_mode: string;
      pin_hash: string;
    }
    | undefined;
  // Single-use connection: edge invocations are short; one query then close.
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    // Scope the lookup to (id, family_id, role='kid'). A profile_id that belongs
    // to another family, or to a parent, simply won't match -> generic 401.
    const rows = await sql<typeof kid[]>`
      select id, family_id, display_name, avatar_url, age_mode, pin_hash
        from profiles
       where id = ${parsed.profile_id}
         and family_id = ${parsed.family_id}
         and role = 'kid'
       limit 1
    `;
    kid = rows[0];
  } catch {
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }

  // Constant-ish-effort path: if the kid doesn't exist (or somehow has no hash),
  // run a bcrypt compare against a dummy hash so timing doesn't trivially reveal
  // existence, then return the SAME 401.
  const hashToCheck = kid?.pin_hash ??
    "$2a$10$WrEQ7qDH14lb9vK.FP.EjOESMIIciE/qIG/6OxUs996pcRIg7vCaG"; // bcrypt of a random string
  const pinOk = await bcrypt.compare(parsed.pin, hashToCheck);

  if (!kid || !pinOk) {
    return json(INVALID_CREDENTIALS, 401);
  }

  // Mint the kid JWT. Claims MUST match migration 002's contract exactly:
  //   role='authenticated' (Postgres role PostgREST switches to),
  //   ll_role='kid', family_id, profile_id, sub=profile_id, aud='authenticated',
  //   short exp.
  const nowSec = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    role: "authenticated",
    ll_role: "kid",
    family_id: kid.family_id,
    profile_id: kid.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(kid.id) // sub = kid profiles.id (NOT an auth.users id)
    .setAudience("authenticated")
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + TOKEN_TTL_SECONDS)
    .sign(secret);

  return json(
    {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: TOKEN_TTL_SECONDS,
      profile: {
        id: kid.id,
        family_id: kid.family_id,
        display_name: kid.display_name,
        avatar_url: kid.avatar_url,
        age_mode: kid.age_mode,
      },
    },
    200,
  );
});
