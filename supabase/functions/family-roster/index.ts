// family-roster Edge Function (task #9, server side — the pre-auth step).
//
// A kid device with NO session types in the family's kid_code; this function
// returns that family's kid roster (first names + avatars + age_mode) so the
// kid can pick their profile, then PIN-login via the kid-auth function.
//
// Kids are not auth.users rows, and anon cannot read profiles/families under
// RLS (migration 002 grants table DML only to `authenticated`). So, exactly
// like kid-auth, THIS FUNCTION is the trust boundary: it opens a direct,
// privileged Postgres connection (SUPABASE_DB_URL, injected by the runtime),
// resolves the code, and returns only the public-ish roster. We deliberately do
// NOT go through PostgREST with the service-role key — service_role isn't
// granted DML on these tables locally, so a REST read hits "permission denied".
// A direct DB connection sidesteps that without widening any table grants the
// db-architect owns.
//
// ============================================================================
// REQUEST / RESPONSE CONTRACT
// ============================================================================
//   POST  (JSON body)
//     { "code": "<family kid_code>" }
//
//   The kid_code alphabet is uppercase 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
//   (migration 005). We uppercase the submitted code before lookup so a kid who
//   types lowercase still matches.
//
//   200 -> { "family_id": "<uuid>", "family_name": "<text>",
//            "kids": [ { "profile_id", "display_name", "avatar_url", "age_mode" }, ... ] }
//          kids ordered by display_name.
//   400 -> { "error": "invalid_request", "message": ... }   missing/empty/oversized code
//   404 -> { "error": "not_found", "message": "No family found for that code." }
//          GENERIC — returned for ANY well-formed-but-unknown code, so the
//          endpoint can't be used to confirm which codes exist beyond what the
//          rate limit already bounds.
//   405 -> { "error": "method_not_allowed" }
//   429 -> { "error": "rate_limited", "message": ... }      see RATE LIMITING
//   500 -> { "error": "server_error" }                      never a stack trace
//
// ============================================================================
// SECURITY MODEL
// ============================================================================
//   The kid_code IS the bearer secret. This endpoint intentionally exposes kid
//   first names + avatars to anyone holding a valid code — that is the accepted
//   product model (a kid device is trusted once it has the code). The code lives
//   in an unambiguous 8-char alphabet (32 symbols), i.e. ~32^8 ≈ 1.1e12 codes.
//   The PRIMARY abuse mitigation against brute-forcing that space is the
//   in-memory rate limit below.
//
//   The code and the DB URL are NEVER logged. Stack traces never reach the
//   caller (every failure path returns a fixed shape).
//
// ============================================================================
// RATE LIMITING
// ============================================================================
//   Simple fixed-window counter keyed by client IP, held in a module-level Map.
//   Limit: RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS window. On exceed →
//   429 BEFORE any DB work (so a flood can't hammer Postgres either).
//
//   CAVEATS (documented on purpose):
//     * PER-INSTANCE only. The edge runtime may run multiple isolates /
//       instances; each keeps its own Map, so the effective global limit is
//       higher. This is a speed-bump, not a hard quota.
//     * IP is read from x-forwarded-for / x-real-ip, which a direct client can
//       spoof. In production this function MUST sit behind a WAF / edge
//       rate-limiter (e.g. Cloudflare, or Supabase's gateway limits) that
//       enforces a trustworthy per-IP/global cap. This Map is defence-in-depth,
//       not the only line.

import postgres from "npm:postgres@3.4.4";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// The generic 404. Identical for every well-formed unknown code so the endpoint
// can't be used to distinguish "no such family" from anything else.
const NOT_FOUND = {
  error: "not_found",
  message: "No family found for that code.",
} as const;

// --- Rate limiting -----------------------------------------------------------
// Small N-per-minute fixed window. Chosen low enough to make brute-forcing the
// ~1.1e12 code space hopeless via this endpoint, high enough that a real kid
// device retrying a typo a handful of times is never blocked.
const RATE_LIMIT_MAX = 20; // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60s, per IP, per instance

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the current window ends
}
const buckets = new Map<string, Bucket>();

// Returns true if this IP is now OVER the limit (request should be rejected).
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT_MAX;
}

// Best-effort client IP. Behind the Supabase gateway the real client lands in
// x-forwarded-for (first hop). Falls back to x-real-ip, then a constant bucket
// (so a missing header still imposes SOME shared limit rather than none).
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Opportunistic eviction so the Map can't grow unbounded across many IPs.
function sweepBuckets(now: number): void {
  if (buckets.size < 10_000) return;
  for (const [ip, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(ip);
  }
}

// --- Input parsing -----------------------------------------------------------
// The code alphabet is uppercase; we uppercase before lookup. Length bound keeps
// a single oversized body from doing any work. We accept any string shape here
// (beyond the bound) and let the DB lookup decide existence → generic 404, so we
// never branch in a way that distinguishes "bad chars" from "unknown code".
const MAX_CODE_LEN = 64;

function parseCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { code } = body as Record<string, unknown>;
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_CODE_LEN) return null;
  return trimmed.toUpperCase();
}

interface KidRow {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  age_mode: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Rate-limit FIRST — before parsing or touching the DB.
  const now = Date.now();
  sweepBuckets(now);
  if (isRateLimited(clientIp(req))) {
    return json(
      { error: "rate_limited", message: "Too many requests. Try again shortly." },
      429,
    );
  }

  let code: string | null;
  try {
    code = parseCode(await req.json());
  } catch {
    code = null; // not JSON
  }
  if (!code) {
    return json(
      { error: "invalid_request", message: "Expected { code: <family code> }." },
      400,
    );
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return json({ error: "server_error" }, 500);
  }

  let family: { id: string; name: string } | undefined;
  let kids: KidRow[] = [];
  // Single-use connection: edge invocations are short; query then close.
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const fam = await sql<{ id: string; name: string }[]>`
      select id, name
        from families
       where kid_code = ${code}
       limit 1
    `;
    family = fam[0];

    if (family) {
      kids = await sql<KidRow[]>`
        select id as profile_id, display_name, avatar_url, age_mode
          from profiles
         where family_id = ${family.id}
           and role = 'kid'
         order by display_name asc
      `;
    }
  } catch {
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }

  // Generic 404 for any unknown code — no enumeration aid.
  if (!family) {
    return json(NOT_FOUND, 404);
  }

  return json(
    {
      family_id: family.id,
      family_name: family.name,
      kids,
    },
    200,
  );
});
