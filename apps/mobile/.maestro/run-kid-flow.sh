#!/usr/bin/env bash
# Run the Maestro kid golden-path flow (task #47) against a booted simulator.
#   1. seeds deterministic data into the local Supabase DB,
#   2. runs the Maestro flow.
# Prereqs: local Supabase up (supabase start), the mobile app installed on a
# booted sim, and Metro running (pnpm --filter mobile start).
#
# Usage:  apps/mobile/.maestro/run-kid-flow.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_Lootloop}"

# Maestro is a JVM app; ensure Java + maestro are on PATH (openjdk is keg-only
# under Homebrew). Override JAVA via $JAVA_HOME if you manage it yourself.
if command -v brew >/dev/null 2>&1 && brew --prefix openjdk >/dev/null 2>&1; then
  export PATH="$(brew --prefix openjdk)/bin:$PATH"
  export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk)}"
fi
export PATH="$HOME/.maestro/bin:$PATH"

echo "→ Seeding deterministic test data (family MAESTRO7 / kid Ava / PIN 1234)…"
docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 < "$DIR/seed-kid-flow.sql" >/dev/null
echo "→ Running Maestro kid golden-path flow…"
exec maestro test "$DIR/kid-chore-flow.yaml"
