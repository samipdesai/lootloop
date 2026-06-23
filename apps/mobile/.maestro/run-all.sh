#!/usr/bin/env bash
# Full E2E matrix: {kid, parent} × {iPhone, iPad} Maestro golden-path flows.
# Used by the pre-push hook (.husky/pre-push) and runnable on demand.
#
# Prereqs (fails fast with guidance if missing):
#   - local Supabase up        (supabase start)
#   - Metro running            (pnpm --filter mobile start)
#   - the app installed on the iPhone + iPad sims
#       (pnpm --filter mobile ios --simulator="iPhone 17 Pro"
#        pnpm --filter mobile ios --simulator="iPad (A16)")
#
# Device names are overridable:  E2E_IPHONE / E2E_IPAD.
# Skip a push without running this:  git push --no-verify
set -uo pipefail   # not -e: we run every flow and report all failures at the end

DIR="$(cd "$(dirname "$0")" && pwd)"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_Lootloop}"
API="${SUPABASE_API_URL:-http://127.0.0.1:54321}"
BUNDLE="org.reactjs.native.example.mobile"
IPHONE_NAME="${E2E_IPHONE:-iPhone 17 Pro}"
IPAD_NAME="${E2E_IPAD:-iPad (A16)}"

# Java + maestro on PATH (openjdk is keg-only under Homebrew).
if command -v brew >/dev/null 2>&1 && brew --prefix openjdk >/dev/null 2>&1; then
  export PATH="$(brew --prefix openjdk)/bin:$PATH"
  export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk)}"
fi
export PATH="$HOME/.maestro/bin:$PATH"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"

red()  { printf '\033[31m%s\033[0m\n' "$1"; }
grn()  { printf '\033[32m%s\033[0m\n' "$1"; }
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
die()  { red "✗ $1"; exit 1; }

# --- Preflight ---------------------------------------------------------------
command -v maestro >/dev/null 2>&1 || die "maestro not found (~/.maestro/bin). Install: curl -Ls https://get.maestro.mobile.dev | bash"
command -v xcrun   >/dev/null 2>&1 || die "xcrun not found — Xcode command line tools required."
docker exec "$DB_CONTAINER" true >/dev/null 2>&1 || die "Supabase DB container '$DB_CONTAINER' not running. Run: supabase start"
[ "$(curl -s http://localhost:8081/status 2>/dev/null)" = "packager-status:running" ] \
  || die "Metro not running on :8081. Run: pnpm --filter mobile start"

# Resolve a simulator UDID by device name; boot it if needed.
udid_for() {
  xcrun simctl list devices available 2>/dev/null \
    | grep -F "$1 (" | head -1 | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
}
ensure_booted() { # <udid>
  local state
  state="$(xcrun simctl list devices | grep -i "$1" | sed -E 's/.*\((Booted|Shutdown)\).*/\1/')"
  if [ "$state" != "Booted" ]; then
    echo "  booting $1…"; xcrun simctl boot "$1" 2>/dev/null || true
  fi
}

IPHONE_UDID="$(udid_for "$IPHONE_NAME")"
IPAD_UDID="$(udid_for "$IPAD_NAME")"
[ -n "$IPHONE_UDID" ] || die "No simulator named '$IPHONE_NAME' (override with E2E_IPHONE)."
[ -n "$IPAD_UDID" ]   || die "No simulator named '$IPAD_NAME' (override with E2E_IPAD)."
ensure_booted "$IPHONE_UDID"
ensure_booted "$IPAD_UDID"

# After the parent email/password login iOS pops a "Save Password?" SYSTEM alert.
# It lives outside the app's accessibility tree, so Maestro can neither see nor
# dismiss it (especially on iPad) — it would block the parent flow. Disable
# password AutoFill on the test sims so the prompt never appears. (Sim-local
# settings; harmless — we never test autofill.)
disable_pw_autofill() { # <udid>
  xcrun simctl spawn "$1" defaults write com.apple.WebUI AutoFillPasswords -bool false 2>/dev/null || true
  xcrun simctl spawn "$1" defaults write com.apple.Preferences AutoFillPasswordsEnabled -bool false 2>/dev/null || true
  xcrun simctl spawn "$1" defaults write com.apple.security AutoFillPasswords -bool false 2>/dev/null || true
  xcrun simctl spawn "$1" defaults write com.apple.keyboard.preferences AutoFillEnabled -bool false 2>/dev/null || true
}
disable_pw_autofill "$IPHONE_UDID"
disable_pw_autofill "$IPAD_UDID"

# App must already be installed (we don't build here — too slow for a hook).
for d in "$IPHONE_UDID:$IPHONE_NAME" "$IPAD_UDID:$IPAD_NAME"; do
  xcrun simctl get_app_container "${d%%:*}" "$BUNDLE" >/dev/null 2>&1 \
    || die "App not installed on '${d##*:}'. Build it: pnpm --filter mobile ios --simulator=\"${d##*:}\""
done

# Service-role key (for the GoTrue admin ensure-parent-user call).
SR="$(supabase status 2>/dev/null | grep -i service_role | sed -E 's/.*"(eyJ[^"]+)".*/\1/')"

seed()  { docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 < "$DIR/$1" >/dev/null; }
ensure_parent_user() {
  curl -s -o /dev/null -X POST "$API/auth/v1/admin/users" \
    -H "Authorization: Bearer $SR" -H "apikey: $SR" -H "Content-Type: application/json" \
    -d '{"email":"parent@maestro.test","password":"Maestro1!","email_confirm":true}' || true
}

FAILED=()
PASSED=0

# Reboot a sim and wait until it's usable again (relaunch the app so it
# reconnects to Metro). Used between retry attempts to get a fresh Maestro driver.
reboot_sim() { # <udid>
  echo "    ↻ rebooting sim for a fresh driver…"
  xcrun simctl shutdown "$1" 2>/dev/null || true
  xcrun simctl boot "$1" 2>/dev/null || true
  xcrun simctl bootstatus "$1" -b >/dev/null 2>&1 || true # block until fully booted
  xcrun simctl launch "$1" "$BUNDLE" >/dev/null 2>&1 || true
  sleep 12 # let the JS bundle load + the app settle before the driver attaches
}

# run <udid> <seed.sql> <flow.yaml> <label>
# Retries once, rebooting the sim first: the iOS Maestro driver (xctest runner)
# accumulates instability across consecutive launchApp/clearState runs and drops
# its connection mid-flow (iPhone sims are especially prone). A fresh-booted sim
# gives a clean driver, so the retry runs reliably.
run_flow() {
  local udid="$1" seedfile="$2" flow="$3" label="$4" attempt
  bold "▶ $label"
  for attempt in 1 2; do
    seed "$seedfile"
    if maestro --device "$udid" test "$DIR/$flow"; then
      grn "  ✓ $label$([ "$attempt" -eq 2 ] && echo ' (retry)')"
      PASSED=$((PASSED + 1)); return
    fi
    [ "$attempt" -eq 1 ] && { red "  … $label failed — rebooting + retrying"; reboot_sim "$udid"; }
  done
  red "  ✗ $label"; FAILED+=("$label")
}

# device: <udid> <label> <flow-suffix>  (iPad flows use the .ipad variant)
for dev in "$IPHONE_UDID|iPhone|" "$IPAD_UDID|iPad|.ipad"; do
  IFS='|' read -r udid name suffix <<< "$dev"
  bold ""
  bold "════════ $name ($udid) ════════"
  run_flow "$udid" seed-kid-flow.sql            "kid-chore-flow${suffix}.yaml"           "$name · kid · chores"
  run_flow "$udid" seed-store-flow.sql          "kid-store-flow${suffix}.yaml"           "$name · kid · store"
  run_flow "$udid" seed-reading-savings-flow.sql "kid-reading-savings-flow${suffix}.yaml" "$name · kid · reading+savings"
  ensure_parent_user
  run_flow "$udid" seed-parent-flow.sql         "parent-overview-flow${suffix}.yaml"     "$name · parent · overview"
done

bold ""
bold "════════ E2E matrix result ════════"
if [ "${#FAILED[@]}" -eq 0 ]; then
  grn "✓ all $PASSED flows passed (kid + parent × iPhone + iPad)"
  exit 0
fi
red "✗ ${#FAILED[@]} failed, $PASSED passed:"
for f in "${FAILED[@]}"; do red "    - $f"; done
exit 1
