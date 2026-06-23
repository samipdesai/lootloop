#!/usr/bin/env bash
# Run the Maestro PARENT golden-path flow against a booted simulator:
#   1. ensure the parent auth user exists (GoTrue admin API; idempotent),
#   2. seed deterministic data (family + kid + parent profile),
#   3. run the Maestro flow.
# Prereqs: local Supabase up, the mobile app installed on a booted sim, Metro up.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_Lootloop}"
API="${SUPABASE_API_URL:-http://127.0.0.1:54321}"

# Java + maestro on PATH (openjdk is keg-only under Homebrew).
if command -v brew >/dev/null 2>&1 && brew --prefix openjdk >/dev/null 2>&1; then
  export PATH="$(brew --prefix openjdk)/bin:$PATH"
  export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk)}"
fi
export PATH="$HOME/.maestro/bin:$PATH"

SR="$(supabase status 2>/dev/null | grep -i service_role | sed -E 's/.*"(eyJ[^"]+)".*/\1/')"

echo "→ Ensuring parent auth user (parent@maestro.test)…"
curl -s -o /dev/null -X POST "$API/auth/v1/admin/users" \
  -H "Authorization: Bearer $SR" -H "apikey: $SR" -H "Content-Type: application/json" \
  -d '{"email":"parent@maestro.test","password":"Maestro1!","email_confirm":true}' || true

echo "→ Seeding deterministic test data…"
docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 < "$DIR/seed-parent-flow.sql" >/dev/null
echo "→ Running Maestro parent golden-path flow…"
exec maestro test "$DIR/parent-overview-flow.yaml"
