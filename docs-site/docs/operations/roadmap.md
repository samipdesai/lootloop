---
title: Roadmap & status
description: Milestone status for v1 (shipped) and the deliberate Phase 2 deferrals.
---

# Roadmap & status

The canonical task breakdown lives in [`lootloop-technical-plan.md`](https://github.com/samipdesai/lootloop/blob/main/lootloop-technical-plan.md) (42 v1 tasks across M1–M5, plus M6 testing and M7 production launch). This page is a status snapshot — treat the plan and the repo (git history) as source of truth.

## 🚀 v1 is live

**LootLoop launched on 2026-06-30** — approved and live on the **App Store** ("LootLoop: Chores & Rewards", `com.lootloop.mobile`), with the web app in production at **[lootloop.us](https://lootloop.us)** on Vercel, backed by the `lootloop-prod` Supabase project. All seven milestones are complete.

## Milestones

| Milestone                      | Scope                                                                                                       | Status              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------- |
| **M1 — Foundation**            | Monorepo scaffold, tooling, CI, Supabase schema + RLS, parent & kid auth, navigation shells                 | ✅ Merged           |
| **M2 — Chore system**          | Chore CRUD, kid claim/complete, approval queue, point award on approval                                     | ✅ Merged           |
| **M3 — Points & reward store** | Kid dashboard, point history, parent bonus, reward store, purchase, fulfillment, celebrations               | ✅ Merged           |
| **M4 — Reading & savings**     | Reading log + approval + streaks, savings transfers, interest calculation & projection                      | ✅ Merged           |
| **M5 — Schedule & polish**     | Schedule CRUD, [age modes](../architecture/frontend-mobile.md) (Simple/Detailed/Teen), realtime, polish     | ✅ Merged           |
| **M6 — Automated test suite**  | Unit backfill (domain, stores, hooks), integration RLS/function tests, E2E (Playwright + Maestro), CI gates | ✅ Merged           |
| **M7 — Production launch**     | Prod Supabase, email, account/family deletion, marketing, legal/COPPA, monitoring, App Store                | ✅ Launched (06-30) |

Highlights of the M7 launch work: production Supabase provisioning (#49); transactional email via Resend on `lootloop.us` (#50); pre-prod security hardening (#51, migration `010`); account & family deletion (#52); Privacy Policy + Terms (#53) and COPPA review + consent record (#54, migration `011`); marketing/coming-soon + public apex (#55); domain + Vercel prod (#56); Apple enrollment + App Store Connect record (#57); listing metadata & screenshots (#58); TestFlight beta (#59); App Store submission & approval (#60); Sentry monitoring, web + mobile (#61); web production deploy pipeline (#62, web half); launch smoke test (#63). See [CI/CD](./ci-cd.md) and [operations](./ops.md).

## Post-launch follow-ups

Small items intentionally left open after launch:

- **Marketing landing page** — the apex currently routes to `/login` (the public front door); a proper marketing landing page is a fast-follow.
- **Automated DB backups** — the daily keep-alive runs; the encrypted `pg_dump` step activates once the `SUPABASE_DB_URL` secret (session-pooler string) is set. See [backup runbook](./ops.md).
- **Mobile TestFlight CI** — see Phase 2 below.

## Phase 2 deferrals (deliberate)

Consciously pushed past v1:

- **Kid-on-web** — kids are mobile-only for v1; the web kid UI is deferred.
- **CocoaPods → SPM** — iOS native deps ship via CocoaPods; the SPM migration waits until RN's SPM path stabilizes. See [stack decisions](../architecture/stack-decisions.md).
- **kid-auth asymmetric keys** — kid PIN sessions sign HS256 with a shared secret (`KID_AUTH_JWT_SECRET`); a move to asymmetric (ES256) signing is a hardening item. See [edge functions](../backend/edge-functions.md).
- **Mobile TestFlight CI (task #62, mobile half)** — `release.yml` is written and the Fastlane `beta` lane is proven locally (builds #1–4 shipped manually), but the Maestro E2E job that gates it hasn't run green on GitHub macOS runners. Activation needs the `MATCH_GIT_BASIC_AUTHORIZATION` secret + `IOS_TESTFLIGHT_ENABLED=true`. See [CI/CD](./ci-cd.md).
- **Android** — mobile is iOS Universal for v1; Android is a stub.
- **OAuth sign-in (Google/Apple)** — parent auth is email/password for v1.
