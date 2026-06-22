# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Repo State

**Pre-implementation.** As of 2026-06-19 this directory contains only `lootloop-technical-plan.md` — no source code, no monorepo scaffold, no `package.json`. Build/lint/test commands listed below describe the _target_ setup defined in the plan; they do not run yet. The first task (#1 in the plan) creates the scaffold.

Always read `lootloop-technical-plan.md` before starting work — it is the source of truth for architecture, task breakdown (42 numbered tasks across 5 milestones), and SDLC conventions. Reference task numbers (e.g. "task #14") rather than restating requirements.

## Product

LootLoop is a family chore & reward management app. Two roles: **parent** (manages chores, rewards, approvals) and **kid** (completes chores, earns points, buys rewards, reads, saves). v1 platform matrix:

| Role   | iPhone | iPad | Web                             |
| ------ | ------ | ---- | ------------------------------- |
| Parent | ✅     | ✅   | ✅ (primary management surface) |
| Kid    | ✅     | ✅   | ❌ (deferred)                   |

## Architecture (Target)

pnpm monorepo:

```
apps/
  mobile/   — bare React Native, iOS Universal target (iPhone + iPad), Android stub for Phase 2
  web/      — Next.js App Router (parent dashboard now; marketing site Phase 2)
packages/
  types/    — Supabase-generated TS types
  client/   — Supabase client wrapper + auth helpers (shared by mobile + web)
  domain/   — pure TS: interest, points, recurrence logic (heavily unit-tested)
supabase/
  migrations/ functions/ seed.sql
```

Backend is **Supabase** (Postgres + RLS + Auth + Edge Functions + Realtime). Family isolation is enforced via RLS — never bypass it from app code. Atomic operations (purchase_reward, transfer_to_savings, point award on approval) live in SQL functions, not client code.

### Portability Rules (keep the Supabase exit cheap)

We're committed to Supabase for v1 and won't migrate unless scale demands it. But a few disciplines keep a future move (to a REST API + RDS, or a self-hosted stack) a contained swap instead of a rewrite — follow them:

- **No raw `supabase` outside `packages/client`.** Screens, stores, and hooks import service-layer functions (e.g. `chores.list(familyId)`), never `supabase.from(...)` / `.rpc(...)` directly. `packages/client` is the only place that knows the backend exists — so swapping it for `fetch('/api/...')` later touches one package, not 30 screens.
- **`packages/domain` stays I/O-free.** Pure TS only (interest, points, recurrence). No Supabase, no `fetch`, no DB imports. Its purity is what makes it portable verbatim.
- **Business logic that must be atomic goes in SQL functions, not client code.** These are plain Postgres functions — they survive a move to any Postgres host. Inline multi-step logic in the client does not.

If a task pushes you to call `supabase` from a screen or add I/O to `domain`, stop and route it through the service layer instead.

Mobile is **adaptive, not separate apps**: one component tree branches on size class via `useSizeClass()` (iPhone → stack/tabs nav; iPad → split-view). Kid UI also branches on `useAgeMode()` (Simple 5-8 / Detailed 9-12 / Teen 13-15). State via Zustand. Styling via **twrnc** (mobile — pure-JS Tailwind runtime, `style={tw\`…\`}`) + Tailwind (web).

## Stack Constraints — Do Not Reintroduce

The plan explicitly rejected these. If a task seems to call for one of them, stop and ask:

- **No Expo / EAS.** Bare RN only. Don't suggest `expo install`, `app.json`, or Expo modules.
- **No NativeWind.** Mobile styling is **twrnc** (`apps/mobile/src/lib/tw.ts`; tokens in `apps/mobile/tailwind.config.js`). NativeWind v4 crashes on RN 0.86/React 19 (css-interop + navigation context); v5 requires `@expo/metro-config` + the `expo` package, which the No-Expo rule forbids. Use `style={tw\`…\`}`/`tw.style(...)`, never a `className` prop. (Web still uses Tailwind normally.)
- **No npm or yarn.** pnpm workspaces only.
- **No `develop` branch.** Trunk-based: `main` + short-lived `feature/<milestone>/<name>` branches, squash-merged.

### iOS dependencies: CocoaPods (for now)

The scaffold ships iOS native deps via **CocoaPods** (RN 0.86's default — `apps/mobile/ios/Podfile` + `Pods/`), not SPM. After adding a native module run `pod install` **from `apps/mobile/ios`** (running it from the repo root resolves the wrong autolink root and fails). Migrating to a Swift-Package-Manager-only setup is a **Phase 2 backlog item** (plan §"Phase 2 — CocoaPods → SPM migration") — RN's SPM path isn't stable yet, so don't attempt SPM-only now.

## Commands (once scaffold exists)

```bash
# Backend
supabase start                              # local Postgres + Auth + Edge Functions in Docker

# Web (Next.js)
pnpm --filter web dev                       # http://localhost:3000
pnpm --filter web build

# Mobile (bare RN)
pnpm --filter mobile start                  # Metro bundler
pnpm --filter mobile ios --simulator="iPhone 15 Pro"
pnpm --filter mobile ios --simulator="iPad Pro (12.9-inch)"

# Quality gates (must pass before merge)
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm -r test --coverage --ci                # CI mode
pnpm --filter <pkg> test -- <pattern>       # single test file/name

# iOS distribution
cd apps/mobile/ios && bundle exec fastlane ios dev    # internal dev build
cd apps/mobile/ios && bundle exec fastlane ios beta   # TestFlight
```

Environment: `.env` at repo root for shared/server values; `apps/web/.env.local` uses `NEXT_PUBLIC_*` prefix; `apps/mobile/.env` is loaded via `react-native-config`. Never bundle `SUPABASE_SERVICE_ROLE_KEY` into client builds.

## Testing Layers

- **Unit (Jest):** `packages/domain/` and `apps/*/src/{stores,hooks}/`. 70% coverage target. Don't unit-test Supabase calls — mock at that boundary.
- **Integration:** Service-layer + RLS policies + atomic DB functions run against local Supabase Docker. RLS tests must prove cross-family isolation.
- **E2E:** Maestro for iOS (same flow file runs on iPhone _and_ iPad simulators), Playwright for web. Keep to 4–6 golden paths.

## Definition of Done (per task)

Zero TS errors, lint clean, tests pass, verified on every applicable form factor (iPhone sim + iPad sim + web), PR green, squash-merged. The plan's task table marks per-task platform scope — honor it (e.g. kid screens are mobile-only; some parent screens are web+mobile).

## Subagents

The plan defines 8 subagents in `.claude/agents/` (scaffolder, db-architect, edge-fn-eng, design-translator, mobile-screen-builder, web-screen-builder, test-author, code-reviewer). These files do not exist yet — they're created in a follow-up pass after the scaffold lands.
