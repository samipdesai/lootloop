# LootLoop - Technical Implementation & SDLC Plan

> **Revision (2026-06-19):** This plan was revised from an Expo-based stack to **bare React Native + Next.js + pnpm monorepo + Supabase**. Rationale: 15 years of iOS experience (Expo's signing-hiding value is wasted), planned Live Activities (bare RN gives clean native targets), preference for fewer third-party deps, and Phase 2 marketing site (Next.js fits). See `~/.claude/plans/binary-skipping-stearns.md` for the revision delta.

## TL;DR

**Stack:**

- iOS Universal app (iPhone + iPad) → bare React Native + Swift Package Manager + Fastlane
- Web (parent dashboard now, marketing later) → Next.js (App Router)
- Backend → Supabase (Postgres + RLS + Auth + Edge Functions + Realtime)
- Monorepo → pnpm workspaces
- Hosting → Vercel (web), App Store / TestFlight (iOS)

**What you need to set up (free tier for all):**

- GitHub account + private repo
- Supabase account (database + auth backend)
- Vercel account (web hosting)
- Apple Developer account ($99/yr — can defer until ready for TestFlight)

**Platform availability matrix (v1):**

| Role       | iPhone | iPad | Web        | Notes                                             |
| ---------- | ------ | ---- | ---------- | ------------------------------------------------- |
| **Parent** | ✅     | ✅   | ✅         | All platforms. Web is primary management surface. |
| **Kid**    | ✅     | ✅   | ❌ (later) | Mobile-only in v1. Kid-on-web deferred.           |

**Lightweight SDLC:**

- GitHub Issues + Projects board (Kanban: Backlog → Ready → In Progress → Done)
- Feature branches → squash-merge PRs (even solo — CI gates catch issues)
- CI on every PR: lint, typecheck, unit tests, web build check (~3 min)
- On merge to `main`: auto-deploy web preview + Fastlane iOS dev build
- On release tag: production deploy

**Testing layers:**

- Unit (Jest) for utils/hooks/stores — 70% coverage target
- Integration (Supabase Docker) for DB functions + RLS policies
- E2E (Maestro for iOS on iPhone + iPad, Playwright for web) — 4-6 golden paths only

**42 tasks across 5 milestones (v1)**, each independently testable on at least one mobile form factor + web (where applicable). A post-v1 **Milestone 6** (6 tasks, #43–#48) hardens the automated test suite — unit + integration coverage backfill plus the E2E/UI regression flows — so regressions are caught as features evolve. **Milestone 7** (15 tasks, #49–#63) is the path to production: prod Supabase, real transactional email, account/family deletion, the `lootloop.us` marketing page, legal + COPPA review, monitoring, and App Store submission. See §5.

**Phase 2 (out of v1 scope):** Marketing site + signup, Android target, Live Activities. Scaffolding is set up from day 1 so these are additive, not rewrites.

**Phase 2 — CocoaPods → SPM migration:** The task #1 scaffold shipped iOS deps via CocoaPods (RN 0.86's default; `ios/Podfile` + `Pods/`), deviating from the plan's stated "No CocoaPods — Swift Package Manager" constraint (§ below). Rationale for deferring: RN 0.86's SPM support is still experimental, and CocoaPods builds and runs cleanly today on iPhone + iPad. Migrate to SPM-only in Phase 2 once RN's SPM path is stable; until then `pod install` stays in the iOS dev loop.

**Phase 2 — Kid session tokens: hand-rolled HS256 → asymmetric (GoTrue/ES256):** `kid-auth` (task #9) mints its own **HS256** JWT for kid PIN sessions (kids aren't `auth.users`, so there's no GoTrue session). This works _only_ because PostgREST still accepts the project's **Legacy JWT Secret** — a fragile, single-point-of-failure dependency: prod uses asymmetric **ES256** signing keys (the JWKS advertises only ES256), so a wrong, corrupted, or rotated legacy secret silently 401s **every** kid. This broke all kid logins in production once (2026-07-01; corrupted `KID_AUTH_JWT_SECRET` value → 401 on every kid REST call). Migrate kid sessions to **GoTrue-issued ES256** tokens that verify against the rotating JWKS exactly like parent tokens do: give kids backing `auth.users` rows and have `kid-auth` mint a real session via the GoTrue Admin API instead of `SignJWT(...HS256...)`. Touches the `profiles` kid-shape constraint (migration 001), the `auth_is_kid()` / `auth_family_id()` RLS helpers (002), `create_kid` (005), and `packages/client/src/kidSession.ts`. Removes the legacy-secret dependency entirely. Guardrails + the current fragility are documented in `docs/ops/supabase-jwt-keys.md`.
**Phase 2 — Mobile TestFlight CI (#62, deferred 2026-07-01):** The `release.yml` pipeline (Maestro E2E → `fastlane beta` → TestFlight on a `v*` tag) is written and its build lane is proven locally (that's how builds #1–4 shipped). Deferred to Phase 2 rather than activated because: (a) the `maestro` job that gates the build has never had a green run on GitHub macOS runners (RN iOS build + iPhone/iPad sim matrix in CI is finicky and needs hardening), and (b) activating needs a `MATCH_GIT_BASIC_AUTHORIZATION` secret (a PAT with read on the private `lootloop-certs` repo) + `IOS_TESTFLIGHT_ENABLED=true`. Until then, TestFlight builds are produced **manually** via `cd apps/mobile/ios && fastlane beta` (verified working). Phase-2 activation = add the two config items, then either harden the CI Maestro job or decouple the build from the E2E gate.

**Revision (2026-06-20) — NativeWind → twrnc:** Mobile styling moved off NativeWind to **twrnc** (pure-JS Tailwind runtime; `style={tw\`…\`}`via`apps/mobile/src/lib/tw.ts`, tokens in `apps/mobile/tailwind.config.js`). NativeWind is incompatible with this stack: v4 crashes on RN 0.86 / React 19 (react-native-css-interop trips a "navigation context" error on dynamic className toggling), and v5's `react-native-css`hardcodes`@expo/metro-config`'s transform worker, which requires the `expo` package — disallowed by the No-Expo constraint. twrnc needs no Babel/Metro plugin, so it sidesteps both (verified booting on iPhone + iPad). Web still uses Tailwind v4.

---

## 1. Lightweight SDLC Process

### Principle

Every merged PR produces something testable on a real device or browser. No invisible infrastructure-only work — even backend changes get verified through a UI interaction.

### Artifacts (Minimal)

| Artifact        | Where                              | Purpose                          |
| --------------- | ---------------------------------- | -------------------------------- |
| Feature plan    | `planning/kid-rewards-app-plan.md` | Already done — this is the "PRD" |
| Technical plan  | This document                      | Architecture + task breakdown    |
| GitHub Issues   | GitHub Projects board              | Work tracking                    |
| PR descriptions | GitHub PRs                         | Change documentation             |
| CHANGELOG.md    | Repo root                          | User-facing release notes        |

No separate design docs, ADRs, or specs needed at this scale.

### Definition of Done (per task)

- [ ] Code compiles with zero TypeScript errors
- [ ] Lint passes (no warnings)
- [ ] Unit tests pass (new code has tests for business logic)
- [ ] Works on iPhone simulator (where applicable)
- [ ] Works on iPad simulator (where applicable)
- [ ] Works on web browser at `localhost:3000` (where applicable)
- [ ] PR approved by CI (all checks green)
- [ ] Merged to `main`

### Branch Strategy

```
main (protected, always deployable)
  └── feature/<milestone>/<short-name>
       e.g. feature/foundation/supabase-schema
            feature/chores/kid-completion-flow
            feature/reading/approval-workflow
```

- **No `develop` branch** — keep it simple, `main` is always the latest working version
- Feature branches are short-lived (1-4 hours of work)
- Merge via squash-merge PR (clean history)

### PR Process (Even Solo)

1. Create feature branch
2. Implement + test locally (iPhone + iPad + web as relevant)
3. Push and open PR (fills in template automatically)
4. CI runs (lint, typecheck, test, build)
5. If green → merge. If red → fix.
6. Delete branch after merge

Why PRs even solo? CI gates catch issues, PR descriptions become documentation, and it's easy to revert if needed.

### Release Process

- **Dev testing:** Every push to a feature branch → local sim builds + Vercel preview URL
- **Staging:** Every merge to `main` → auto-deploy web preview + Fastlane `ios dev` build
- **Production:** Git tag `v0.1.0` → production web deploy + Fastlane `ios beta` → TestFlight

---

## 2. GitHub Repository Setup

### Initial Setup

```bash
# Create repo
gh repo create lootloop --private --description "Family chore & reward management app"

# Clone and initialize
git clone <repo-url>
cd lootloop
```

### Branch Protection Rules (main)

- Require PR before merging
- Require status checks to pass (lint, typecheck, test, build-web)
- Require linear history (squash merge only)
- No force push
- No deletions

### Issue Templates

**Bug Report** (`.github/ISSUE_TEMPLATE/bug.md`)

```markdown
---
name: Bug
about: Something isn't working
labels: bug
---

**What happened?**

**Expected behavior?**

**Steps to reproduce:**

1.
2.
3.

**Platform:** iPhone / iPad / Web / Multiple
**Screenshot (if applicable):**
```

**Feature Task** (`.github/ISSUE_TEMPLATE/task.md`)

```markdown
---
name: Task
about: Implementation task
labels: task
---

**What to build:**

**Acceptance criteria:**

- [ ]
- [ ]
- [ ]

**Dependencies:** #issue_number (or none)

**Verify on:**

- [ ] iPhone (simulator)
- [ ] iPad (simulator)
- [ ] Web browser
```

### PR Template (`.github/pull_request_template.md`)

```markdown
## What

<!-- One sentence: what does this PR do? -->

## Why

<!-- Link to issue: Closes #XX -->

## How to test

<!-- Steps to verify on each relevant platform -->

1.
2.
3.

## Screenshots

<!-- Before/after if UI change; include iPhone + iPad if mobile -->
```

### Labels

| Label                       | Color  | Use                    |
| --------------------------- | ------ | ---------------------- |
| `bug`                       | red    | Something broken       |
| `task`                      | blue   | Implementation work    |
| `milestone:foundation`      | purple | Days 1-2               |
| `milestone:chores`          | purple | Days 3-4               |
| `milestone:points-store`    | purple | Days 5-6               |
| `milestone:reading-savings` | purple | Days 7-8               |
| `milestone:polish`          | purple | Days 9-10              |
| `platform:mobile`           | teal   | Touches `apps/mobile/` |
| `platform:web`              | teal   | Touches `apps/web/`    |
| `platform:backend`          | teal   | Touches `supabase/`    |
| `blocked`                   | orange | Waiting on something   |
| `quick-win`                 | green  | < 1 hour               |

### GitHub Projects Board

Columns (Kanban):

- **Backlog** → **Ready** → **In Progress** → **In Review** → **Done**

Automation:

- New issue → Backlog
- PR opened → In Review
- PR merged → Done

---

## 3. CI/CD Pipeline (GitHub Actions)

### Workflow: PR Checks (`.github/workflows/pr-checks.yml`)

Triggers: every push to a PR branch

```yaml
Jobs:
  1. lint-and-typecheck:
    - pnpm install --frozen-lockfile
    - pnpm -r lint
    - pnpm -r typecheck

  2. test:
    - pnpm install --frozen-lockfile
    - pnpm -r test --coverage --ci
    - Upload coverage report

  3. build-web:
    - pnpm install --frozen-lockfile
    - pnpm --filter web build
    - (Verifies Next.js build compiles)

  4. mobile-typecheck:
    - pnpm install --frozen-lockfile
    - pnpm --filter mobile typecheck
    - (Does NOT build the iOS binary on PR — too slow/expensive)
```

**Total PR check time target: < 3 minutes**

### Workflow: Deploy on Merge (`.github/workflows/deploy.yml`)

Triggers: push to `main`

```yaml
Jobs:
  1. deploy-web-preview:
    - pnpm install --frozen-lockfile
    - Vercel auto-deploys on push (no explicit step needed)
    - Wait for Vercel deployment, post URL as commit status

  2. ios-dev-build:
    - macos-latest runner
    - pnpm install --frozen-lockfile
    - cd apps/mobile/ios && bundle exec fastlane ios dev
    - Uploads .ipa to internal distribution (Firebase App Distribution or similar)
    - Posts build link as commit status
```

### Workflow: Production Release (`.github/workflows/release.yml`)

Triggers: push tag `v*`

```yaml
Jobs:
  1. deploy-web-production:
    - Tag triggers Vercel production deploy (configured in Vercel project settings)

  2. ios-testflight:
    - macos-latest runner
    - pnpm install --frozen-lockfile
    - cd apps/mobile/ios && bundle exec fastlane ios beta
    - Uploads to TestFlight via App Store Connect API

  3. create-github-release:
    - Generate release notes from commits
    - Attach build links
```

### Secrets Needed in GitHub

| Secret                          | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `SUPABASE_URL`                  | Supabase project URL                       |
| `SUPABASE_ANON_KEY`             | Supabase public anon key                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | For Edge Function deploys (CI only)        |
| `SUPABASE_ACCESS_TOKEN`         | For `supabase functions deploy`            |
| `VERCEL_TOKEN`                  | Web deployment (if doing explicit deploys) |
| `MATCH_PASSWORD`                | Fastlane match certificate decryption      |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Fastlane match Git access                  |
| `APP_STORE_CONNECT_API_KEY`     | TestFlight upload (base64-encoded .p8)     |
| `APP_STORE_CONNECT_KEY_ID`      | App Store Connect key ID                   |
| `APP_STORE_CONNECT_ISSUER_ID`   | App Store Connect issuer ID                |

---

## 4. Testing Strategy

### Testing Pyramid

```
        /  E2E  \          ← Few (critical happy paths only)
       /----------\
      / Integration \      ← Some (service layer + DB)
     /----------------\
    /    Unit Tests     \  ← Many (utils, hooks, components)
   /____________________\
```

### Unit Tests (Jest + React Native Testing Library + Testing Library for web)

**What to test:**

- Utility functions (interest calculation, point math, date/recurrence logic) — `packages/domain/`
- Zustand stores (state transitions) — `apps/mobile/src/stores/`
- React hooks (useChores, usePoints, useSavings, useSizeClass, useAgeMode)
- Components (render correctly, handle interactions)

**What NOT to unit test:**

- Supabase client calls (mock boundary — test in integration)
- Navigation wiring
- Styling

**Target: 70% coverage on `packages/domain/`, `apps/*/src/stores/`, `apps/*/src/hooks/`**

### Integration Tests (Supabase Local via Docker)

**What to test:**

- Service layer functions actually work with PostgreSQL
- RLS policies enforce correctly (parent can't see other family's data)
- Database functions (purchase_reward, transfer_to_savings) handle edge cases
- Edge Functions (kid auth, interest calculation)

**Setup:** Supabase local (`supabase start`) runs PostgreSQL + Auth + Edge Functions in Docker. Tests hit this real local instance.

**Target: Cover all atomic DB functions + RLS policies**

### E2E Tests (Maestro for iOS, Playwright for web)

**What to test (critical paths only):**

1. Parent signup → create family → add kid
2. Create chore → kid completes → parent approves → points appear
3. Kid purchases reward
4. Kid saves points + interest calculation

**Target: 4-6 E2E flows covering the golden paths**

**Maestro runs on both iPhone simulator AND iPad simulator** — the same flow file works for both; the size-class-aware UI adapts automatically.

**Why Maestro over Detox:**

- Simpler YAML-based test definitions
- Works with bare RN dev builds (just point at the simulator/device)
- Faster to write for a 2-week project

### When Tests Run

| Trigger                | Unit               | Integration         | E2E                                          |
| ---------------------- | ------------------ | ------------------- | -------------------------------------------- |
| Local dev (pre-commit) | ✓ (affected files) | —                   | —                                            |
| PR CI                  | ✓ (all)            | ✓ (Supabase Docker) | —                                            |
| Merge to main          | ✓                  | ✓                   | ✓ (web via Playwright)                       |
| Release                | ✓                  | ✓                   | ✓ (mobile via Maestro on iPhone + iPad sims) |

---

## 5. Task Breakdown (GitHub Issues)

42 tasks across 5 v1 milestones, plus a post-v1 **Milestone 6** (automated test suite, tasks #43–#48) and **Milestone 7** (production launch, tasks #49–#63). Task IDs preserved from the original plan so prior issues carry over cleanly. Each task notes its target platform(s).

### Milestone 1: Foundation (Days 1-2) — 10 tasks

| #   | Task                                                                                                                                                    | Acceptance Criteria                                                                                | Dependencies | Est |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ | --- |
| 1   | Monorepo scaffold (pnpm + bare RN + Next.js + shared packages)                                                                                          | App boots "Hello LootLoop" on iPhone sim, iPad sim, AND browser. Mobile target is Universal (1,2). | None         | 4h  |
| 2   | Configure ESLint, Prettier, Husky pre-commit hook (root + per-app)                                                                                      | Lint runs on commit, catches errors                                                                | #1           | 1h  |
| 3   | Set up GitHub Actions CI (lint + typecheck + test + web build + mobile typecheck)                                                                       | PR checks pass green                                                                               | #2           | 1h  |
| 4   | Supabase project creation + local Docker setup                                                                                                          | `supabase start` works, can connect                                                                | None         | 1h  |
| 5   | Database schema migration (all tables + indexes)                                                                                                        | All tables created, can query locally                                                              | #4           | 2h  |
| 6   | RLS policies + database functions                                                                                                                       | Policies enforce family isolation                                                                  | #5           | 2h  |
| 7   | Supabase client init + env config (shared `packages/client/`)                                                                                           | Both apps connect to Supabase, log "connected"                                                     | #1, #4       | 1h  |
| 8   | Parent auth (signup + login) — implemented on **mobile AND web**                                                                                        | Can create account and log in on any of: iPhone, iPad, web                                         | #7           | 3h  |
| 9   | Kid auth Edge Function + PIN/password login screen — **mobile only**                                                                                    | Kid enters PIN on iPhone or iPad, gets JWT, sees kid shell                                         | #6, #7       | 3h  |
| 10  | Navigation shells: web layout + mobile RootNavigator (adaptive: ParentTabs on iPhone, ParentSplitView on iPad, KidTabs on iPhone, KidSplitView on iPad) | Correct shell renders based on role + size class, placeholder screens                              | #8, #9       | 3h  |

### Milestone 2: Chore System (Days 3-4) — 8 tasks

| #   | Task                                                       | Acceptance Criteria                                                                     | Dependencies | Est |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------ | --- |
| 11  | Chore data service (CRUD operations) in `packages/client/` | Service functions work in tests against local Supabase                                  | #6           | 2h  |
| 12  | Parent: Create Chore screen (form) — **web AND mobile**    | Parent can create a chore with title, points, recurrence, assignment from web or mobile | #10, #11     | 4h  |
| 13  | Parent: Chore List screen — **web AND mobile**             | Parent sees all chores, can edit/delete                                                 | #12          | 3h  |
| 14  | Recurring chore generation Edge Function                   | Daily chore instances appear for recurring chores                                       | #11          | 2h  |
| 15  | Kid: My Chores screen — **mobile**                         | Kid sees today's assigned + claimable chores on iPhone or iPad                          | #10, #11     | 2h  |
| 16  | Kid: Claim + complete chore flow — **mobile**              | Kid can claim a shared chore and mark any chore complete                                | #15          | 2h  |
| 17  | Parent: Approval Queue screen — **web AND mobile**         | Parent sees pending completions, can approve/reject from any platform                   | #16          | 3h  |
| 18  | Point award on approval (atomic)                           | Approving a chore adds points to kid's wallet balance                                   | #17          | 2h  |

### Milestone 3: Points + Reward Store (Days 5-6) — 8 tasks

| #   | Task                                                                    | Acceptance Criteria                                                    | Dependencies | Est |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ | --- |
| 19  | Kid: Dashboard with wallet balance — **mobile**                         | Kid sees current point balance prominently                             | #18          | 2h  |
| 20  | Point transaction history view — **mobile (kid) + web/mobile (parent)** | Kid sees own history; parent sees per-kid history                      | #19          | 2h  |
| 21  | Parent: Award bonus points — **web AND mobile**                         | Parent can give ad-hoc points to any kid with a note from any platform | #18          | 2h  |
| 22  | Parent: Reward Store management (CRUD) — **web AND mobile**             | Parent can create/edit/delete reward items with point costs            | #10          | 3h  |
| 23  | Kid: Browse Reward Store — **mobile**                                   | Kid sees available rewards with costs, disabled if too expensive       | #22, #19     | 2h  |
| 24  | Kid: Purchase reward (atomic DB function) — **mobile**                  | Kid buys reward, balance deducted, purchase recorded                   | #23          | 2h  |
| 25  | Parent: Fulfillment queue — **web AND mobile**                          | Parent sees purchased rewards to mark as given                         | #24          | 2h  |
| 26  | Celebration animations (earn + purchase) — **mobile**                   | Lottie animation plays when points earned or reward purchased          | #19, #24     | 2h  |

### Milestone 4: Reading + Savings (Days 7-8) — 9 tasks

| #   | Task                                                                   | Acceptance Criteria                                                | Dependencies | Est |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------ | --- |
| 27  | Kid: Reading log entry (manual minutes + book title) — **mobile**      | Kid can submit a reading entry                                     | #10          | 2h  |
| 28  | Reading approval workflow — **web AND mobile (parent)**                | Reading entries appear in parent approval queue, points on approve | #27, #17     | 2h  |
| 29  | Reading streak tracking                                                | Streak increments on approved entries, resets on missed day        | #28          | 2h  |
| 30  | Kid: Reading screen (log list + streak display) — **mobile**           | Kid sees reading history and current/longest streak                | #29          | 2h  |
| 31  | Kid: Savings screen (wallet vs savings balances) — **mobile**          | Kid sees both balances with visual piggy bank                      | #19          | 2h  |
| 32  | Savings transfer (deposit/withdraw atomic function) — **mobile (kid)** | Kid can move points between wallet and savings                     | #31          | 2h  |
| 33  | Savings transaction history — **mobile**                               | Kid sees deposit/withdrawal/interest log                           | #32          | 1h  |
| 34  | Monthly interest Edge Function (cron)                                  | Savings earn compound interest at month end                        | #32          | 2h  |
| 35  | Interest projection display — **mobile**                               | "If you save X, next month you'll earn Y" calculator               | #34          | 1h  |

### Milestone 5: Schedule + Polish (Days 9-10) — 7 tasks

| #   | Task                                                                                   | Acceptance Criteria                                                                                 | Dependencies | Est |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | --- |
| 36  | Parent: Create schedule items per kid — **web AND mobile**                             | Parent can add time-based items to a kid's daily schedule                                           | #10          | 2h  |
| 37  | Kid: Daily timeline view — **mobile**                                                  | Kid sees visual timeline of today's schedule                                                        | #36          | 3h  |
| 38  | Age mode: Simple (ages 5-8) — **mobile**                                               | Larger touch targets, icons, bright colors for simple mode kids                                     | #10          | 3h  |
| 39  | Age mode: Detailed (ages 9-12) — **mobile**                                            | Stats, progress bars, more text for detailed mode kids                                              | #38          | 2h  |
| 40  | Age mode: Teen (ages 13-15) — **mobile**                                               | Mature dashboard, minimal gamification for teen mode                                                | #39          | 2h  |
| 41  | Realtime subscriptions (cross-device updates)                                          | Parent approves on web → kid sees update on iPhone or iPad instantly                                | #18          | 2h  |
| 42  | Final polish (loading states, error states, empty states, iPhone/iPad adaptive polish) | No blank screens, graceful errors, proper loading indicators, layouts polished on both form factors | All          | 4h  |

**Total: 42 tasks across 5 milestones (v1).** A sixth, post-v1 milestone (automated test suite) follows below.

**Note on timeline:** Two scope expansions vs the original Expo-based plan:

1. Adding iPhone alongside iPad — handled by adaptive layouts sharing business logic + component trees.
2. Adding parent surfaces to mobile (original had parent CRUD as web-only) — adds real feature work.

Realistic risk: +1.5 to +2 days vs the original 10-day target. Day 9 is the most loaded. If tight, the natural cut is "parent mobile = approvals + balance views only; CRUD stays web-only" — reverts most of expansion #2.

### Milestone 6: Automated Test & Regression Suite (Post-v1) — 6 tasks

Runs once the v1 product is functional (Milestones 1–5 merged). The §4 testing strategy describes _what_ to test; this milestone makes that coverage **tracked, deliverable work** rather than an implicit Day-10 line item. The goal is a CI-enforced safety net that catches regressions as features evolve. Maps the §4 testing pyramid bottom-up: unit → integration → E2E → CI gates.

| #   | Task                                                                          | Acceptance Criteria                                                                                                                                                                                                                    | Dependencies  | Est |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --- |
| 43  | Unit backfill: `packages/domain/` (interest, points, recurrence)              | ≥70% coverage on `packages/domain/`; edge cases covered — interest rounding/compounding, point math, recurrence boundaries, streak increment/reset                                                                                     | #29, #34      | 3h  |
| 44  | Unit backfill: Zustand stores + hooks (`apps/*/src/{stores,hooks}/`)          | ≥70% coverage; state transitions + `useSizeClass` / `useAgeMode` / `useChores` / `usePoints` / `useSavings` tested; Supabase mocked at the boundary                                                                                    | All v1 UI     | 4h  |
| 45  | Integration suite: RLS isolation + atomic functions + Edge Functions (Docker) | Against `supabase start`: cross-family isolation proven for all tables; `purchase_reward` / `transfer_to_savings` / `award_points_on_approval` / `credit_interest` edge cases + idempotency; `kid-auth` + `calculate-interest` covered | #6, #34       | 4h  |
| 46  | E2E web (Playwright): parent golden paths                                     | Green in CI: signup → create family → add kid; create chore → approve → points appear; reward CRUD → fulfillment                                                                                                                       | #25, #28      | 4h  |
| 47  | E2E mobile (Maestro, iPhone + iPad): kid + cross-device golden paths          | One flow file runs on BOTH sims: kid completes chore; kid purchases reward; kid saves points + sees interest. Cross-device: parent approves on web → kid sees update                                                                   | #26, #32, #41 | 4h  |
| 48  | CI/CD wiring + coverage & regression gates                                    | Per §4 "When Tests Run": Playwright on merge-to-`main`, Maestro on release; 70% coverage threshold enforced as a PR gate; a failing E2E/coverage check blocks merge                                                                    | #46, #47, #3  | 2h  |

**Total Milestone 6: 6 tasks (~21h).** Sequence bottom-up (43 → 44 → 45 → 46 → 47 → 48); 43–45 can run in parallel with 46–47 once their feature deps are merged. Owned primarily by the **test-author** subagent (E2E) with **db-architect** on #45 and screen-builders backfilling #43–#44.

### Milestone 7: Production Launch (Path to Production) — 15 tasks

Runs once v1 is feature-complete and verified (M1–5 merged) and the M6 safety net is green. §7 (DevOps) already documents the production _infrastructure_ — Supabase prod project, Vercel hosting, Fastlane `beta` lane → TestFlight — but only as prose under a "set up when ready to ship" note. This milestone turns that into **tracked, sequenced launch work** and fills the gaps §7 doesn't cover: real transactional email (today's signup confirmations are caught by local Mailpit and never delivered), in-app account/family deletion (an App Store requirement, not just a nicety), the `lootloop.us` marketing page, legal pages, a COPPA/kids-data review, production monitoring, and the App Store submission itself. **iOS + web only — Android stays Phase 2.**

| #   | Task                                            | Acceptance Criteria                                                                                                                                                                                                                                                                                                   | Dependencies       | Est |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --- |
| 49  | Provision production Supabase (`lootloop-prod`) | Migrations applied; Edge Functions deployed; JWT + function secrets set; monthly interest cron scheduled; prod anon/service keys issued (service_role server-only). Per §7 "Supabase Cloud Setup."                                                                                                                    | All v1             | 3h  |
| 50  | Production transactional email (SMTP)           | `[auth.email.smtp]` configured with a provider (Resend/Postmark); sender domain verified with SPF/DKIM/DMARC; confirmation + password-reset templates branded; real end-to-end delivery confirmed (no longer caught by local Mailpit)                                                                                 | #49                | 3h  |
| 51  | Pre-production security & data audit            | `get_advisors` security + perf lints clean; RLS verified on every table incl. cross-family isolation; `service_role` confirmed absent from client bundles; PITR/backups enabled; secrets rotated (⚠ NOT the Legacy JWT Secret — `kid-auth` + the anon/service keys depend on it; see `docs/ops/supabase-jwt-keys.md`) | #49                | 3h  |
| 52  | Account & family deletion                       | `leave_family()` + `delete_family()` SECURITY DEFINER SQL fns (self-authorizing, last-parent guard) + `delete-account` Edge Function (service_role → `auth.admin.deleteUser`); web + mobile UI with hard-confirm. Satisfies App Store Guideline 5.1.1(v)                                                              | #49                | 5h  |
| 53  | Privacy Policy + Terms of Service               | Hosted pages (on marketing site) covering data collected, kids'-data handling, retention/deletion; linked from signup, in-app settings, and the App Store listing                                                                                                                                                     | #55                | 2h  |
| 54  | COPPA / kids-data compliance review             | Verifiable parental-consent model documented (parents create + control kid profiles; kids have no independent signup); data minimization for under-13; decide standard vs Kids Category; disclosures aligned with the privacy policy                                                                                  | #53                | 3h  |
| 55  | Marketing "Coming soon" page (lootloop.us)      | `apps/web/app/(marketing)/` route group with a branded coming-soon hero (loop+coin), short value prop, optional email capture; renders at site root; lint + typecheck clean                                                                                                                                           | —                  | 3h  |
| 56  | Connect lootloop.us to Vercel production        | Domain + DNS + SSL on Vercel prod; prod env vars point to `lootloop-prod`; routing decided (marketing at apex, dashboard at `/app` or `app.lootloop.us`); preview-vs-prod separation confirmed                                                                                                                        | #49, #55           | 2h  |
| 57  | Apple Developer enrollment + App Store Connect  | Apple Developer Program active ($99/yr); App Store Connect app record created; **bundle id reconciled** (PR #17 sets `com.lootloop.app`; §7 Matchfile example says `com.lootloop.mobile` — pick one); `match` appstore certs working                                                                                  | —                  | 2h  |
| 58  | App Store listing metadata & assets             | Name/subtitle/description/keywords; iPhone + iPad screenshots; age rating; App Privacy "nutrition label" data-collection answers; support + marketing URLs (lootloop.us)                                                                                                                                              | #57, #53           | 3h  |
| 59  | TestFlight beta                                 | `fastlane ios beta` uploads a Release build; internal + external testers added; validated on real iPhone + iPad against the prod backend                                                                                                                                                                              | #57, #49           | 3h  |
| 60  | App Store submission & review                   | Submit for review; respond to feedback (expect scrutiny on kids'-data/COPPA and the account-deletion path); release to the App Store                                                                                                                                                                                  | #58, #59, #52, #54 | 4h  |
| 61  | Error & crash monitoring                        | Sentry (or equivalent) wired into web (Next.js) + mobile (RN); dSYM / source-map upload in release builds; alerting on prod errors; alert on `kid-auth` 5xx and kid `/rest` 401 spikes (early warning for JWT-secret/signing-key breakage, per `docs/ops/supabase-jwt-keys.md`)                                       | #49                | 3h  |
| 62  | Production CI/CD wiring                         | `deploy.yml` / `release.yml` extended to ship web → Vercel prod and Edge Functions → `lootloop-prod` on tagged release; required secrets in GitHub. Per §3 workflows                                                                                                                                                  | #49                | 2h  |
| 63  | Launch-readiness checklist & prod smoke test    | End-to-end prod smoke: real-email signup → confirm → create family → add kid → kid login → chore → approve → reward; rollback plan documented; go/no-go checklist signed off                                                                                                                                          | All above          | 2h  |

**Total Milestone 7: 15 tasks (~43h).** #55 (marketing) and #57 (Apple enrollment) have no dependencies and can start immediately; #49 (prod Supabase) gates most backend/web/ops work. Critical path to the App Store: **#49 → #52 → #58 → #59 → #60**, with the legal/compliance gates (#53, #54) and account deletion (#52) hard-blocking review (#60). Code-bearing tasks map to existing subagents (**db-architect** #49/#51/#52-SQL, **edge-fn-eng** #52-edge-fn, **web-screen-builder** #53/#55/#56, **test-author** #63); the rest (#50, #54, #57–#62) are config/account/ops steps done manually.

---

## 6. Development Environment Setup

### Prerequisites

| Tool           | Version | Purpose                                               |
| -------------- | ------- | ----------------------------------------------------- |
| Node.js        | 22 LTS  | Runtime (pnpm 11.8 requires ≥22.13; CI + local on 22) |
| pnpm           | 9+      | Package manager (monorepo)                            |
| Watchman       | Latest  | File watching (React Native)                          |
| Xcode          | 15+     | iOS Universal builds (Mac only)                       |
| Docker Desktop | Latest  | Supabase local                                        |
| Supabase CLI   | Latest  | Local dev, migrations, type gen                       |
| Fastlane       | Latest  | iOS builds, signing, TestFlight                       |
| Git            | 2.40+   | Version control                                       |
| VS Code        | Latest  | IDE (recommended)                                     |

**No CocoaPods.** React Native ships with Swift Package Manager as the default iOS dependency manager. CocoaPods is in maintenance mode and being phased out. Xcode resolves SPM packages automatically — no `pod install` step in the dev loop.

**No Expo / EAS CLI.** Stack does not use Expo.

### Install Commands

```bash
# pnpm
npm install -g pnpm

# Watchman (macOS)
brew install watchman

# Supabase CLI
brew install supabase/tap/supabase

# Fastlane
brew install fastlane

# Verify Docker is running
docker info

# Start Supabase locally (after `supabase init` in the repo)
supabase start
# Outputs: API URL, anon key, service_role key → put in .env
```

### Environment Variables (`.env` at repo root, consumed by both apps)

```bash
# Supabase (shared by mobile + web)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>   # server-only, never bundled

# App
APP_ENV=development
```

For the Next.js web app, `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

For the React Native mobile app, `apps/mobile/.env`:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key>
```

(loaded via `react-native-config` or similar)

### Running Locally

```bash
# Terminal 1: Supabase
supabase start

# Terminal 2: Web (Next.js)
pnpm --filter web dev
# → http://localhost:3000

# Terminal 3: Metro (RN bundler)
pnpm --filter mobile start

# Terminal 4: iOS sim
pnpm --filter mobile ios --simulator="iPhone 15 Pro"
# or
pnpm --filter mobile ios --simulator="iPad Pro (12.9-inch)"
```

### Testing on Real iPhone / iPad

1. Open `apps/mobile/ios/Mobile.xcworkspace` (or `.xcodeproj` for SPM-only projects) in Xcode
2. Connect device via USB, select it as the run target
3. Configure code signing (your existing Apple Developer team)
4. Cmd+R to build and run
5. Metro hot reload works the same as the simulator

For TestFlight distribution: use Fastlane (see `apps/mobile/ios/fastlane/`).

---

## 7. DevOps / Infrastructure

### Environments

| Env            | Supabase                      | Web                   | Mobile                                           | Purpose             |
| -------------- | ----------------------------- | --------------------- | ------------------------------------------------ | ------------------- |
| **Local**      | Docker (`supabase start`)     | localhost:3000        | iOS sim or USB device                            | Daily development   |
| **Preview**    | Supabase cloud (dev project)  | Vercel preview URL    | Fastlane `ios dev` build (internal distribution) | PR review + testing |
| **Production** | Supabase cloud (prod project) | Vercel production URL | TestFlight → App Store                           | Real users          |

For the 2-week build: **start with Local + Preview only**. Production setup happens when ready to ship.

### Supabase Cloud Setup

- **Plan:** Free tier (sufficient for development + small family use)
  - 500MB database, 2GB bandwidth, 50k auth users, 500k Edge Function invocations
- **Region:** Closest to user
- **Create two projects:** `lootloop-dev` and `lootloop-prod` (later)

### Fastlane Setup (`apps/mobile/ios/fastlane/Fastfile`)

```ruby
default_platform(:ios)

platform :ios do
  desc "Sync code signing"
  lane :certificates do
    match(type: "development", readonly: true)
    match(type: "appstore", readonly: true)
  end

  desc "Local dev build (for internal distribution)"
  lane :dev do
    match(type: "development")
    build_app(
      scheme: "Mobile",
      configuration: "Debug",
      export_method: "development"
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    match(type: "appstore")
    increment_build_number(xcodeproj: "Mobile.xcodeproj")
    build_app(scheme: "Mobile", configuration: "Release", export_method: "app-store")
    upload_to_testflight(
      api_key_path: "fastlane/api_key.json",
      skip_waiting_for_build_processing: true
    )
  end
end
```

`match` config in `apps/mobile/ios/fastlane/Matchfile`:

```ruby
git_url("git@github.com:<your-org>/lootloop-certificates.git")
storage_mode("git")
type("development")
app_identifier(["com.lootloop.mobile"])
username("your-apple-id@example.com")
```

### Vercel Web Hosting

- Connect GitHub repo to Vercel
- Root directory: `apps/web`
- Framework preset: Next.js (auto-detected)
- Build command: `pnpm install --frozen-lockfile && pnpm --filter web build`
- Output directory: auto
- Auto-deploy on push to `main` (preview) and on tags (production)

### Supabase Edge Function Deployment

```bash
# Deploy all Edge Functions
supabase functions deploy kid-auth --project-ref <ref>
supabase functions deploy calculate-interest --project-ref <ref>
supabase functions deploy generate-recurring-chores --project-ref <ref>
```

In CI, this runs on merge to `main` using `SUPABASE_ACCESS_TOKEN` secret.

---

## 8. Project File Structure (Final — Monorepo)

```
lootloop/                             # pnpm monorepo root
├── pnpm-workspace.yaml               # workspaces: apps/*, packages/*
├── package.json                      # root scripts (lint, test, build)
├── tsconfig.base.json                # shared TS config
├── .github/
│   ├── workflows/
│   │   ├── pr-checks.yml
│   │   ├── deploy.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.md
│   │   └── task.md
│   └── pull_request_template.md
├── apps/
│   ├── mobile/                       # bare React Native (iOS Universal; Android stub for Phase 2)
│   │   ├── ios/                      # Xcode project, SPM resolved
│   │   │   └── fastlane/
│   │   ├── android/                  # generated but unbuilt in v1
│   │   ├── src/
│   │   │   ├── screens/              # adaptive layouts (size-class aware)
│   │   │   ├── components/
│   │   │   ├── hooks/                # useSizeClass(), useAgeMode(), useChores, etc.
│   │   │   ├── stores/               # Zustand
│   │   │   ├── navigation/           # split-nav on iPad, stack-nav on iPhone
│   │   │   └── theme/
│   │   ├── __tests__/
│   │   ├── metro.config.js
│   │   ├── babel.config.js
│   │   ├── tailwind.config.js        # design tokens for twrnc
│   │   └── package.json
│   └── web/                          # Next.js (App Router)
│       ├── app/
│       │   ├── (marketing)/          # empty scaffolding in v1 (Phase 2 fills in)
│       │   ├── (dashboard)/
│       │   │   └── app/
│       │   │       ├── chores/
│       │   │       ├── approvals/
│       │   │       ├── kids/
│       │   │       └── rewards/
│       │   ├── api/                  # Supabase callbacks if needed
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       ├── __tests__/
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   ├── types/                        # Supabase generated types
│   ├── client/                       # Supabase client wrapper + auth helpers
│   └── domain/                       # interest, points, recurrence — pure TS
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions_and_triggers.sql
│   ├── functions/
│   │   ├── kid-auth/index.ts
│   │   ├── calculate-interest/index.ts
│   │   └── generate-recurring-chores/index.ts
│   └── seed.sql                      # Dev seed data (sample family)
├── design/
│   └── claude-design/                # HTML mockups from claude.ai/design
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── CHANGELOG.md
└── README.md
```

---

## 9. Day-by-Day Execution Schedule

| Day | Focus                                                                                                           | Key Deliverable                                                                                                          | Testable On         |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1   | Monorepo + bare RN init (Universal target) + Next.js init + Supabase Docker + CI green                          | App boots "Hello LootLoop" on iPhone sim, iPad sim, AND browser; PR check workflow green                                 | iPhone + iPad + Web |
| 2   | Schema + RLS + parent auth (mobile + web) + kid auth Edge Function + adaptive navigation shells                 | Parent logs in on web AND mobile; kid logs in on mobile only; role-correct shells render with size-class-appropriate nav | iPhone + iPad + Web |
| 3   | Parent chore CRUD (web + mobile) + recurring chore Edge Function                                                | Parent creates chores from web or mobile; recurring instances generate                                                   | iPhone + iPad + Web |
| 4   | Kid chore flow (mobile) + parent approval queue (web + mobile)                                                  | Full lifecycle works cross-device; parent can approve from either platform                                               | iPhone + iPad + Web |
| 5   | Points dashboard (mobile kid) + bonus award (web + mobile parent)                                               | Kid sees balance on iPhone or iPad; parent awards bonus from anywhere                                                    | iPhone + iPad + Web |
| 6   | Reward store CRUD (web + mobile parent) + purchase flow (mobile kid) + fulfillment (web + mobile parent)        | Full reward lifecycle                                                                                                    | iPhone + iPad + Web |
| 7   | Reading log (mobile kid) + reading approval (web + mobile parent) + streak tracking                             | Streak persists across days                                                                                              | iPhone + iPad + Web |
| 8   | Savings transfer (mobile kid) + monthly interest cron + projections                                             | Interest credits run via cron Edge Function                                                                              | iPhone + iPad       |
| 9   | Schedule items (web + mobile parent) + timeline view (mobile kid) + three age modes + iPhone/iPad layout polish | UI adapts per kid's age mode AND per size class                                                                          | iPhone + iPad + Web |
| 10  | Realtime subscriptions + E2E suite (Maestro on both iPhone and iPad, Playwright on web) + polish                | Cross-device sync; 4-6 E2E flows pass on both form factors                                                               | iPhone + iPad + Web |

---

## 10. Subagent Roster (Claude-Driven Execution)

Eight subagents in `.claude/agents/`. Main Claude orchestrates; agents execute bounded units. Created in a follow-up pass once the repo exists.

| Agent                     | Scope                                                                                                                                                                                                              | Model  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **scaffolder**            | One-shot: pnpm monorepo, bare RN init, Next.js init, shared packages, Tailwind (web) / twrnc (mobile), ESLint/Prettier/Husky, GitHub Actions, Fastlane skeleton                                                    | Sonnet |
| **db-architect**          | Postgres migrations, RLS policies, atomic SQL functions, integration tests against local Supabase                                                                                                                  | Opus   |
| **edge-fn-eng**           | Supabase Edge Functions: `kid-auth`, `calculate-interest`, `generate-recurring-chores` + their tests                                                                                                               | Sonnet |
| **design-translator**     | Extracts RN + Tailwind specs from `design/claude-design/*.html`. Owns age-mode variants, size-class variants (iPhone vs iPad), and state coverage (loading/empty/error). Derives iPhone layouts from iPad mockups. | Opus   |
| **mobile-screen-builder** | Builds one bare RN screen at a time from a design spec. Implements adaptive layout (size-class branches) in one component. Wires Zustand + service layer + UI + unit tests.                                        | Sonnet |
| **web-screen-builder**    | Builds one Next.js dashboard route at a time from a design spec. RSC where appropriate; client components for interactive surfaces.                                                                                | Sonnet |
| **test-author**           | Maestro flows (iPhone + iPad) + Playwright flows (web) for 4-6 golden paths. Iterates until green.                                                                                                                 | Sonnet |
| **code-reviewer**         | Adversarial review of PR diffs. Flags RLS leaks, missing tests, type holes, drift from design spec.                                                                                                                | Opus   |

**Orchestration phases:**

- **Phase 1 — Foundation (serial):** scaffolder → db-architect → edge-fn-eng (kid-auth) → code-reviewer
- **Phase 2 — Features (parallel pipeline):** for each task: design-translator → (mobile-screen-builder OR web-screen-builder) → code-reviewer
- **Phase 3 — Hardening:** test-author + screen-builders (polish) in parallel → code-reviewer (final sweep)

---

## 11. Quick-Start Checklist (Before Day 1)

- [ ] Create GitHub account (if needed) + create `lootloop` private repo
- [ ] Create Supabase account at supabase.com (free tier)
- [ ] Create Vercel account at vercel.com (free tier) — for web hosting
- [ ] Apple Developer account ($99/yr) — defer until TestFlight push
- [ ] Install prerequisites (Node 22, Docker Desktop, Xcode, Watchman)
- [ ] Install pnpm: `npm install -g pnpm`
- [ ] Install Supabase CLI: `brew install supabase/tap/supabase`
- [ ] Install Fastlane: `brew install fastlane`
- [ ] Confirm iPhone and iPad simulators are available in Xcode
- [ ] (Optional) Have a real iPhone and iPad ready for USB testing

Not needed: Expo CLI, EAS CLI, CocoaPods, expo.dev account.
