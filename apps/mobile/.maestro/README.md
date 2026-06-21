# Maestro E2E flows (task #47)

Mobile end-to-end flows for LootLoop, driven by [Maestro](https://maestro.mobile.dev).
One flow file runs on **both** iPhone and iPad simulators — the size-class-aware UI
adapts, so the same steps pass on either form factor.

## Flows

| File                  | Golden path                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `kid-chore-flow.yaml` | Kid family-code login → roster → PIN → Chores tab → mark a chore done (#9 / #15 / #16)          |
| `kid-store-flow.yaml` | Kid login → Store tab → buy a reward → balance drops, celebration fires (#19 / #23 / #24 / #26) |

Each flow has a matching `seed-*.sql` (run first) that recreates a deterministic test
family as the postgres superuser, so every run starts clean.

## One-time setup

- **Java 11+** (Maestro is a JVM app): `brew install openjdk` (keg-only — the runner adds it to PATH).
- **Maestro**: `curl -fsSL "https://get.maestro.mobile.dev" | bash`

## Running

Prereqs: local Supabase up (`supabase start`), the app built + installed on a booted
sim (`pnpm --filter mobile ios`), and Metro running (`pnpm --filter mobile start`).

```bash
# iPhone (uses the booted sim):
apps/mobile/.maestro/run-kid-flow.sh

# A specific device (e.g. iPad), driving Maestro directly:
docker exec -i supabase_db_Lootloop psql -U postgres -f - < apps/mobile/.maestro/seed-kid-flow.sql
maestro --device <UDID> test apps/mobile/.maestro/kid-chore-flow.yaml
```

`run-kid-flow.sh` first runs `seed-kid-flow.sql`, which (re)creates a deterministic test
family — code **`MAESTRO7`**, kid **Ava** / PIN **`1234`**, one chore + today's instance —
as the postgres superuser, so every run starts from a clean, actionable state.

## Notes

- Text inputs are targeted by `testID` (`kid-code-input`, `kid-pin-input`); buttons/labels
  by visible text. The roster tile is tapped by its `accessibilityLabel` ("Sign in as Ava")
  since the label absorbs the child text on iOS.
- **Kid-shell tabs are tapped by `testID`** (`tab-Home`/`tab-Chores`/`tab-Store`, set via
  `tabBarButtonTestID` + the iPad sidebar's `testID`): iOS tab-bar accessibility bounds are
  unreliable to tap by visible text.
- Maestro **full-matches** the selector regex against an element's text, so partial matches
  need `.*` (e.g. `Buy for.*`, `Need.*`).
- CI wiring (run on release per §4) is task #48.
