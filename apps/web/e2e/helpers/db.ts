import { execFileSync } from 'node:child_process';

// Direct postgres superuser access for E2E seeding/teardown. Mirrors the Maestro
// approach (run-all.sh): privileged DML goes through the postgres superuser, not
// service_role PostgREST. We shell out to `psql` inside the local Supabase DB
// container so no `pg` dependency is added to the web app.
//
// This is TEST-only infrastructure (e2e/), not app code — it never imports the
// app's Supabase client and adds no `supabase.from(...)` to any screen, so the
// portability rules stay intact.

const CONTAINER = process.env.E2E_DB_CONTAINER ?? 'supabase_db_Lootloop';

// Run a SQL statement (or batch) as the postgres superuser. Returns stdout.
// Tuples-only + unaligned so callers can parse single scalars trivially.
export function sql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', statement],
    { encoding: 'utf8' },
  ).trim();
}

// Convenience: run SQL and return the first scalar (e.g. a returned id).
export function sqlScalar(statement: string): string {
  return sql(statement).split('\n')[0]?.trim() ?? '';
}
