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
BUNDLE="com.lootloop.app"
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

# Fire the SAME atomic function the web parent "Approve" button calls, over the
# postgres superuser connection. Used by the cross-device realtime flow: Maestro
# only drives the mobile (kid) app, so the parent-side approval is simulated here.
#
# award_points_on_approval is SECURITY DEFINER and self-authorizes the CALLER via
# auth_role()/auth_family_id() (it reads auth.uid()/auth.jwt()). As the bare
# superuser those are null and the call is rejected — so we wrap it in a txn that
# sets `role authenticated` + a JWT `sub` claim resolving to the seeded parent
# profile's auth user (parent@maestro.test), exactly like the SQL function tests do.
# Completion + reviewer (parent profile) ids are the fixed ones in the seed.
CROSS_COMPLETION_ID="aaaaaaaa-0000-0000-0000-000000000006"
CROSS_PARENT_PROFILE_ID="aaaaaaaa-0000-0000-0000-000000000004"
approve_cross_device() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1
begin;
-- Resolve the parent's auth uid + set the JWT claim while still superuser: the
-- authenticated role can't SELECT auth.users. THEN drop to authenticated so the
-- SECURITY DEFINER fn self-authorizes against the claim (the local GUC survives
-- the role switch within the txn).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'parent@maestro.test'))::text,
  true
);
set local role authenticated;
select award_points_on_approval('$CROSS_COMPLETION_ID', '$CROSS_PARENT_PROFILE_ID');
commit;
SQL
}

# run_cross_device_flow <udid> <flow.yaml> <label>
# Like run_flow, but BACKGROUNDS the parent approval so it lands while the kid app
# is parked on Home — proving the balance updates live via realtime (no kid action,
# no refresh). CROSS_APPROVE_DELAY seconds covers login + reaching Home before the
# credit fires; the flow's 575 assertion has a 60s timeout to absorb it + latency.
CROSS_APPROVE_DELAY="${CROSS_APPROVE_DELAY:-35}"
run_cross_device_flow() {
  local udid="$1" flow="$2" label="$3" attempt
  bold "▶ $label"
  for attempt in 1 2; do
    seed "seed-cross-device-flow.sql"
    # Background the out-of-band approval; it fires CROSS_APPROVE_DELAY s after we
    # launch the flow, i.e. while the kid is parked on Home awaiting the push.
    ( sleep "$CROSS_APPROVE_DELAY"; approve_cross_device ) &
    local bg_pid=$!
    if maestro --device "$udid" test "$DIR/$flow"; then
      kill "$bg_pid" 2>/dev/null || true; wait "$bg_pid" 2>/dev/null || true
      grn "  ✓ $label$([ "$attempt" -eq 2 ] && echo ' (retry)')"
      PASSED=$((PASSED + 1)); return
    fi
    kill "$bg_pid" 2>/dev/null || true; wait "$bg_pid" 2>/dev/null || true
    [ "$attempt" -eq 1 ] && { red "  … $label failed — rebooting + retrying"; reboot_sim "$udid"; }
  done
  red "  ✗ $label"; FAILED+=("$label")
}

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
  # Cross-device realtime: the parent auth user (ensured above) backs the seed's
  # parent profile + the out-of-band approval the harness fires mid-flow.
  run_cross_device_flow "$udid" "cross-device-approval-flow${suffix}.yaml" "$name · kid · cross-device realtime"
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
