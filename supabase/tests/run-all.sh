#!/usr/bin/env bash
# LootLoop integration suite runner (task #45).
#
# Runs the ENTIRE SQL integration suite (RLS isolation + atomic functions) with
# one command, against the LOCAL Supabase Postgres in Docker. Optionally also
# runs the Edge Function runners (kid-auth + calculate-interest).
#
# Each *_test.sql file seeds its own fixed-UUID fixtures inside a single
# transaction that ROLLBACKs at the end, so order doesn't matter and the DB is
# left untouched. A file "passes" iff it prints "ALL TESTS PASSED" and psql exits
# 0 (ON_ERROR_STOP aborts on the first failed assertion).
#
# USAGE:
#   supabase start                          # Docker stack must be up
#   supabase db reset                       # apply migrations fresh (recommended)
#   supabase/tests/run-all.sh               # SQL suite only
#   RUN_EDGE=1 supabase/tests/run-all.sh    # SQL suite + Edge Function runners
#
# The edge path needs `supabase functions serve` reachable and pulls keys from
# `supabase status`; it serves the two functions itself and tears them down.
#
# ENV overrides:
#   DB_CONTAINER   Postgres container name           (default supabase_db_Lootloop)
#   RUN_EDGE       set to 1 to also run edge runners  (default off)
set -uo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase_db_Lootloop}"
TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${TESTS_DIR}/../.." && pwd)"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n'  "$*"; }

# Fail fast if the DB container isn't up.
if ! docker exec "${DB_CONTAINER}" true >/dev/null 2>&1; then
  red "ERROR: Postgres container '${DB_CONTAINER}' not reachable."
  red "Run 'supabase start' first (and 'supabase db reset' to apply migrations)."
  exit 2
fi

fail_count=0
pass_count=0

bold "== SQL integration suite (${TESTS_DIR}) =="
for f in "${TESTS_DIR}"/*_test.sql; do
  name="$(basename "$f")"
  printf '  %-48s ' "${name}"
  out="$(docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres \
           -v ON_ERROR_STOP=1 -f - < "$f" 2>&1)"
  rc=$?
  if [ $rc -eq 0 ] && grep -q "ALL TESTS PASSED" <<<"$out"; then
    green "PASS"
    pass_count=$((pass_count + 1))
  else
    red "FAIL"
    echo "$out" | grep -E "FAIL|ERROR|ROLLBACK" | sed 's/^/      /'
    fail_count=$((fail_count + 1))
  fi
done

# ---------------------------------------------------------------------------
# Edge Function runners (opt-in: RUN_EDGE=1). These exercise the deployed edge
# functions over HTTP. calculate-interest is self-seeding; kid-auth needs a
# seeded kid with a known PIN, which we create here via pgcrypto bcrypt.
# ---------------------------------------------------------------------------
if [ "${RUN_EDGE:-}" = "1" ]; then
  bold ""
  bold "== Edge Function runners =="

  # `supabase status -o json` emits a JSON object of keys; pull what we need.
  status="$(supabase status -o json 2>/dev/null)"
  jget() { grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" <<<"$status" \
             | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'; }
  ANON_KEY="$(jget ANON_KEY)"
  SERVICE_ROLE_KEY="$(jget SERVICE_ROLE_KEY)"
  JWT_SECRET="$(jget JWT_SECRET)"
  JWT_SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"

  if [ -z "${SERVICE_ROLE_KEY}" ] || [ -z "${ANON_KEY}" ]; then
    red "  SKIP: could not read keys from 'supabase status'."
  else
    # Seed a kid with PIN 1234 (bcrypt via pgcrypto) for the kid-auth runner.
    KA_FAMILY="aaaaaaaa-0000-4000-8000-00000000ed01"
    KA_KID="bbbbbbbb-0000-4000-8000-00000000ed01"
    docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
create extension if not exists pgcrypto;
delete from profiles where id = '${KA_KID}';
delete from families where id = '${KA_FAMILY}';
insert into families (id, name) values ('${KA_FAMILY}', 'Edge Runner Family');
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values ('${KA_KID}', '${KA_FAMILY}', 'kid', 'Edge Kid',
          crypt('1234', gen_salt('bf', 10)), 'detailed');
SQL

    # Serve both functions in the background.
    serve_log="$(mktemp)"
    ( cd "${REPO_ROOT}" && supabase functions serve kid-auth calculate-interest --no-verify-jwt ) \
      >"${serve_log}" 2>&1 &
    serve_pid=$!
    # Wait for the functions endpoint to come up.
    for _ in $(seq 1 30); do
      if curl -fsS "http://127.0.0.1:54321/functions/v1/kid-auth" \
           -X OPTIONS >/dev/null 2>&1; then break; fi
      sleep 1
    done

    run_edge() {
      local label="$1"; shift
      printf '  %-48s ' "${label}"
      if "$@" >/tmp/edge_out.$$ 2>&1; then
        green "PASS"; pass_count=$((pass_count + 1))
      else
        red "FAIL"; sed 's/^/      /' /tmp/edge_out.$$; fail_count=$((fail_count + 1))
      fi
      rm -f /tmp/edge_out.$$
    }

    run_edge "kid-auth/run-tests.mjs" \
      env ANON_KEY="${ANON_KEY}" JWT_SECRET="${JWT_SECRET}" \
          TEST_FAMILY_ID="${KA_FAMILY}" TEST_PROFILE_ID="${KA_KID}" TEST_PIN="1234" \
      node "${REPO_ROOT}/supabase/functions/kid-auth/run-tests.mjs"

    run_edge "calculate-interest/run-tests.mjs" \
      env SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" ANON_KEY="${ANON_KEY}" \
          DB_CONTAINER="${DB_CONTAINER}" \
      node "${REPO_ROOT}/supabase/functions/calculate-interest/run-tests.mjs"

    # Teardown: stop serve + remove the seeded kid-auth fixtures.
    kill "${serve_pid}" >/dev/null 2>&1
    wait "${serve_pid}" 2>/dev/null
    rm -f "${serve_log}"
    docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres >/dev/null 2>&1 <<SQL
delete from profiles where id = '${KA_KID}';
delete from families where id = '${KA_FAMILY}';
SQL
  fi
fi

bold ""
if [ $fail_count -eq 0 ]; then
  green "== ALL SUITES PASSED (${pass_count} passed) =="
  exit 0
else
  red "== ${fail_count} SUITE(S) FAILED (${pass_count} passed) =="
  exit 1
fi
