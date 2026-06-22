// calculate-interest Edge Function (task #34).
//
// Monthly maintenance job: credits compound interest on every kid's savings
// balance. Acceptance: "Monthly interest accrues on savings."
//
// This is a PRIVILEGED MAINTENANCE JOB, not a user-facing endpoint. It is meant
// to be invoked by a scheduler (pg_cron / a monthly trigger) using the project
// SERVICE-ROLE key. It is NOT something a kid or parent client calls.
//
// ============================================================================
// REQUEST / RESPONSE CONTRACT
// ============================================================================
//   POST  (JSON body, all fields optional)
//     { "family_id": "<uuid>",   // optional: scope to one family; else all
//       "kid_id":    "<uuid>" }  // optional: scope to one kid (wins over family_id)
//
//   200 -> { "credited": <int>, "total": <int>, "scope": "all"|"family"|"kid" }
//          credited = number of kids who received an interest credit (>= 1 pt).
//          total    = sum of all points credited this run.
//          Kids whose interest rounds to 0 (and balances <= 0) are skipped, so a
//          re-run after balances change credits only the newly-eligible delta.
//   400 -> { "error": "invalid_request", "message": ... }   malformed body
//   401 -> { "error": "unauthorized" }                      missing/non-service bearer
//   405 -> { "error": "method_not_allowed" }
//   500 -> { "error": "server_error" }                      never a stack trace
//
// ============================================================================
// TRUST MODEL
// ============================================================================
//   The Supabase functions gateway already requires SOME valid project JWT in
//   the Authorization header before a request reaches this code. On top of that
//   we require the bearer to equal the SERVICE-ROLE key (SUPABASE_SERVICE_ROLE_KEY,
//   injected into the function runtime). That blocks anon/kid/parent tokens from
//   triggering a privileged bulk write. The key is compared, never logged.
//
//   DB access uses a direct privileged Postgres connection (SUPABASE_DB_URL),
//   mirroring generate-recurring-chores: the atomic seam credit_interest() is
//   SECURITY DEFINER and granted to service_role only (migration 003), so a
//   direct service-role connection can execute it while a kid/parent PostgREST
//   call cannot. The balance update + 'interest' ledger row stay atomic inside
//   that function.
//
// ============================================================================
// INTEREST RULE  (kept in sync with packages/domain/src/interest.ts)
// ============================================================================
//   5% flat monthly teaching rate, applied to the current savings_balance:
//       interest = Math.round(savings_balance * 0.05)
//   Points are INTEGER, so the amount is rounded to the nearest whole point
//   (banker's-half-up via Math.round). Deno can't easily import the workspace TS
//   package, so calculateInterest is PORTED below. If the rule changes in either
//   place, update the other.

import postgres from "npm:postgres@3.4.4";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- ported interest logic (see packages/domain/src/interest.ts) ----------
const MONTHLY_RATE = 0.05;

function calculateInterest(balance: number): number {
  return Math.round(balance * MONTHLY_RATE);
}
// --------------------------------------------------------------------------

interface CalcInput {
  family_id: string | null;
  kid_id: string | null;
}

// Returns typed input, or null (-> 400). Both fields optional; kid_id scopes to
// a single kid and takes precedence over family_id.
function parseInput(body: unknown): CalcInput | null {
  // Empty body is valid (defaults: all families). Treat a non-object (other
  // than null/undefined) as malformed.
  let family_id: string | null = null;
  let kid_id: string | null = null;

  if (body !== null && body !== undefined) {
    if (typeof body !== "object") return null;
    const obj = body as Record<string, unknown>;
    if (obj.family_id !== undefined && obj.family_id !== null) {
      if (typeof obj.family_id !== "string" || !UUID_RE.test(obj.family_id)) {
        return null;
      }
      family_id = obj.family_id;
    }
    if (obj.kid_id !== undefined && obj.kid_id !== null) {
      if (typeof obj.kid_id !== "string" || !UUID_RE.test(obj.kid_id)) {
        return null;
      }
      kid_id = obj.kid_id;
    }
  }

  return { family_id, kid_id };
}

// True if the request bears the service-role key. The gateway already enforced
// a valid project JWT; here we additionally require it be the service role.
function isServiceRole(req: Request): boolean {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected) return false;
  const auth = req.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return m[1] === expected;
}

interface WalletRow {
  kid_id: string;
  savings_balance: number;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!isServiceRole(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  let parsed: CalcInput | null;
  try {
    // Allow an empty body (no JSON) -> defaults (all families).
    const text = await req.text();
    parsed = parseInput(text.length === 0 ? undefined : JSON.parse(text));
  } catch {
    parsed = null; // not JSON
  }
  if (!parsed) {
    return json(
      {
        error: "invalid_request",
        message: 'Expected optional { family_id: "<uuid>", kid_id: "<uuid>" }.',
      },
      400,
    );
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return json({ error: "server_error" }, 500);
  }

  // kid_id (single kid) wins over family_id (one family), else all families.
  const scope = parsed.kid_id ? "kid" : parsed.family_id ? "family" : "all";

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    // Fetch wallets with a positive savings balance, optionally scoped. Only
    // savings_balance > 0 can possibly yield interest >= 1 (5% of <= 9 still
    // rounds to 0, but those are cheaply filtered out below).
    const wallets = parsed.kid_id
      ? await sql<WalletRow[]>`
          select kid_id, savings_balance
            from wallets
           where savings_balance > 0
             and kid_id = ${parsed.kid_id}
        `
      : parsed.family_id
      ? await sql<WalletRow[]>`
          select kid_id, savings_balance
            from wallets
           where savings_balance > 0
             and family_id = ${parsed.family_id}
        `
      : await sql<WalletRow[]>`
          select kid_id, savings_balance
            from wallets
           where savings_balance > 0
        `;

    let credited = 0;
    let total = 0;

    for (const w of wallets) {
      const amount = calculateInterest(w.savings_balance);
      if (amount < 1) continue; // interest rounds to 0 -> skip

      // Atomic credit: updates savings_balance + writes the 'interest' ledger
      // row under the wallet row lock (migration 003). Granted to service_role.
      await sql`select credit_interest(${w.kid_id}::uuid, ${amount}::integer)`;
      credited += 1;
      total += amount;
    }

    return json({ credited, total, scope }, 200);
  } catch {
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
