---
title: Roadmap & status
description: Milestone status for v1 and the deliberate Phase 2 deferrals.
---

# Roadmap & status

The canonical task breakdown lives in [`lootloop-technical-plan.md`](https://github.com/samipdesai/lootloop/blob/main/lootloop-technical-plan.md) (42 numbered tasks across the core milestones, plus later milestones for testing and production). This page is a status snapshot — treat the plan and the repo as source of truth.

## Milestones

| Milestone                      | Scope                                                                                                                                        | Status         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **M1 — Foundation**            | Monorepo scaffold, tooling, CI, Supabase schema + RLS, parent & kid auth, navigation shells                                                  | ✅ Merged      |
| **M2 — Chore system**          | Chore CRUD, kid claim/complete, approval queue, point award on approval                                                                      | ✅ Merged      |
| **M3 — Points & reward store** | Kid dashboard, point history, parent bonus, reward store, purchase, fulfillment, celebrations                                                | ✅ Merged      |
| **M4 — Reading & savings**     | Reading log + approval + streaks, savings transfers, interest calculation & projection                                                       | ✅ Merged      |
| **M5 — Schedule & polish**     | Schedule CRUD, [age modes](../architecture/frontend-mobile.md) (Simple/Detailed/Teen), realtime subscriptions, final polish                  | 🚧 In progress |
| **M6 — Automated test suite**  | Unit backfill (domain, stores, hooks), integration RLS/function tests, E2E (Playwright + Maestro), CI gates                                  | ⏳ Queued      |
| **M7 — Production launch**     | Prod Supabase, transactional email, account/family deletion (Apple-required), marketing site, COPPA review, monitoring, App Store submission | ⏳ Queued      |

## Phase 2 deferrals (deliberate)

These were consciously pushed past v1:

- **Kid-on-web** — kids are mobile-only for v1; the web kid UI is deferred.
- **CocoaPods → SPM** — iOS native deps ship via CocoaPods; the SPM migration waits until RN's SPM path stabilizes. See [stack decisions](../architecture/stack-decisions.md).
- **kid-auth asymmetric keys** — kid PIN sessions sign HS256 with a shared secret (`KID_AUTH_JWT_SECRET`); a move to asymmetric (ES256) signing is a Phase 2 hardening item. See [edge functions](../backend/edge-functions.md).
- **TestFlight CI gate** — the Maestro E2E matrix has not yet had a green run on GitHub macOS runners; TestFlight builds are currently produced via a locally-verified Fastlane lane. See [CI/CD](./ci-cd.md).
- **Marketing site** — a full landing/marketing surface is Phase 2 (a coming-soon page exists).
- **Android** — mobile is iOS Universal for v1; Android is a stub.
