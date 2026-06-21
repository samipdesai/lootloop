// generate-recurring-chores Edge Function (task #14).
//
// Materializes chore_instances rows for recurring chores on a given date.
// Acceptance: "Daily chore instances appear for recurring chores."
//
// This is a PRIVILEGED MAINTENANCE JOB, not a user-facing endpoint. It is meant
// to be invoked by a scheduler (pg_cron / a daily trigger) using the project
// SERVICE-ROLE key. It is NOT something a kid or parent client calls.
//
// ============================================================================
// REQUEST / RESPONSE CONTRACT
// ============================================================================
//   POST  (JSON body, all fields optional)
//     { "date": "YYYY-MM-DD",        // default: today (server local date)
//       "family_id": "<uuid>" }      // optional: scope to one family; else all
//
//   200 -> { "generated": <int>, "date": "YYYY-MM-DD" }
//          generated = chore_instances rows ACTUALLY inserted (ON CONFLICT DO
//          NOTHING means a re-run for the same date returns 0 -> idempotent).
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
//   mirroring kid-auth: the app tables grant DML only to `authenticated` (RLS,
//   migration 002), so a service-role PostgREST write would hit "permission
//   denied". A direct connection sidesteps that without widening table grants.
//
// ============================================================================
// RECURRENCE SUBSET  (kept in sync with packages/domain/src/recurrence.ts)
// ============================================================================
//   FREQ=DAILY                  -> every day.
//   FREQ=WEEKLY;BYDAY=MO,WE,..  -> only listed weekdays (no BYDAY -> every day).
//   null / empty                -> does not recur (one-off; not generated here).
//   Anything else               -> false (do not generate).
//   Deno can't easily import the workspace TS package, so occursOn is PORTED
//   below. If you change the supported subset in either place, update the other.

import postgres from "npm:postgres@3.4.4";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- ported occursOn (see packages/domain/src/recurrence.ts) --------------
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function occursOn(recurrenceRule: string | null, date: Date): boolean {
  if (recurrenceRule == null) return false;
  const rule = recurrenceRule.trim();
  if (rule.length === 0) return false;

  const parts = new Map<string, string>();
  for (const segment of rule.split(";")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim().toUpperCase();
    const value = segment.slice(eq + 1).trim().toUpperCase();
    if (key.length > 0) parts.set(key, value);
  }

  const freq = parts.get("FREQ");
  if (freq === "DAILY") return true;

  if (freq === "WEEKLY") {
    const byday = parts.get("BYDAY");
    if (byday === undefined || byday.length === 0) return true;
    const wanted = byday.split(",").map((d) => d.trim()).filter((d) =>
      d.length > 0
    );
    const todayCode = DAY_CODES[date.getUTCDay()];
    return wanted.includes(todayCode);
  }

  return false;
}
// --------------------------------------------------------------------------

interface GenerateInput {
  date: string; // YYYY-MM-DD
  family_id: string | null;
}

// Today's server-local date as YYYY-MM-DD.
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Returns typed input, or null (-> 400). Defaults date to today; family_id is
// optional (null = all families).
function parseInput(body: unknown): GenerateInput | null {
  // Empty body is valid (defaults). Treat non-object (other than null/undefined)
  // as malformed.
  let date = todayIso();
  let family_id: string | null = null;

  if (body !== null && body !== undefined) {
    if (typeof body !== "object") return null;
    const obj = body as Record<string, unknown>;
    if (obj.date !== undefined) {
      if (typeof obj.date !== "string" || !DATE_RE.test(obj.date)) return null;
      // Reject impossible dates (e.g. 2026-13-40).
      const parsed = new Date(`${obj.date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return null;
      // Round-trip guard: Date normalizes overflow, so confirm it matches.
      if (parsed.toISOString().slice(0, 10) !== obj.date) return null;
      date = obj.date;
    }
    if (obj.family_id !== undefined && obj.family_id !== null) {
      if (typeof obj.family_id !== "string" || !UUID_RE.test(obj.family_id)) {
        return null;
      }
      family_id = obj.family_id;
    }
  }

  return { date, family_id };
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

interface ChoreRow {
  id: string;
  family_id: string;
  points: number;
  recurrence_rule: string | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!isServiceRole(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  let parsed: GenerateInput | null;
  try {
    // Allow an empty body (no JSON) -> defaults.
    const text = await req.text();
    parsed = parseInput(text.length === 0 ? undefined : JSON.parse(text));
  } catch {
    parsed = null; // not JSON
  }
  if (!parsed) {
    return json(
      {
        error: "invalid_request",
        message: 'Expected optional { date: "YYYY-MM-DD", family_id: "<uuid>" }.',
      },
      400,
    );
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return json({ error: "server_error" }, 500);
  }

  // The weekday is determined from the target date at UTC midnight so it is
  // independent of the runtime's timezone (the ported occursOn uses getUTCDay).
  const targetDate = new Date(`${parsed.date}T00:00:00Z`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    // Fetch active, recurring chores (optionally scoped to one family), then
    // filter in TS with the recurrence subset.
    const chores = parsed.family_id
      ? await sql<ChoreRow[]>`
          select id, family_id, points, recurrence_rule
            from chores
           where active = true
             and recurrence_rule is not null
             and family_id = ${parsed.family_id}
        `
      : await sql<ChoreRow[]>`
          select id, family_id, points, recurrence_rule
            from chores
           where active = true
             and recurrence_rule is not null
        `;

    const due = chores.filter((c) => occursOn(c.recurrence_rule, targetDate));

    if (due.length === 0) {
      return json({ generated: 0, date: parsed.date }, 200);
    }

    // Bulk insert with ON CONFLICT (chore_id, due_date) DO NOTHING for
    // idempotency. `RETURNING id` yields only rows actually inserted.
    const values = due.map((c) => ({
      family_id: c.family_id,
      chore_id: c.id,
      due_date: parsed.date,
      points: c.points,
    }));

    const inserted = await sql`
      insert into chore_instances ${
      sql(values, "family_id", "chore_id", "due_date", "points")
    }
      on conflict (chore_id, due_date) do nothing
      returning id
    `;

    return json({ generated: inserted.length, date: parsed.date }, 200);
  } catch {
    return json({ error: "server_error" }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
