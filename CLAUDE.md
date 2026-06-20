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

Mobile is **adaptive, not separate apps**: one component tree branches on size class via `useSizeClass()` (iPhone → stack/tabs nav; iPad → split-view). Kid UI also branches on `useAgeMode()` (Simple 5-8 / Detailed 9-12 / Teen 13-15). State via Zustand. Styling via NativeWind (mobile) + Tailwind (web).

## Stack Constraints — Do Not Reintroduce

The plan explicitly rejected these. If a task seems to call for one of them, stop and ask:

- **No Expo / EAS.** Bare RN only. Don't suggest `expo install`, `app.json`, or Expo modules.
- **No CocoaPods.** iOS deps via Swift Package Manager (Xcode resolves automatically — no `pod install` step).
- **No npm or yarn.** pnpm workspaces only.
- **No `develop` branch.** Trunk-based: `main` + short-lived `feature/<milestone>/<name>` branches, squash-merged.

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
