# LootLoop

A family chore & reward management app. Parents create chores, rewards, schedules, and approve work; kids complete chores, earn and spend points, log reading, and save (with interest). Two clients — a bare React Native iOS app (iPhone + iPad) and a Next.js web dashboard — over a Supabase backend.

## Documentation

The **[system-design wiki](./docs-site/)** is the primary docs surface — architecture, data model, security/RLS, edge & atomic functions, per-feature guides, and end-to-end flows (with Mermaid diagrams). It's a Docusaurus site under `docs-site/`, published to **https://samipdesai.github.io/lootloop/** on merge to `main`. Run it locally with `cd docs-site && pnpm install && pnpm start`.

| Doc                                                        | What                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| [**Wiki (`docs-site/`)**](./docs-site/)                    | Full system-design & feature wiki (Docusaurus) — the primary reference     |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                       | Legacy architecture doc — content now lives in the wiki; kept as a pointer |
| [lootloop-technical-plan.md](./lootloop-technical-plan.md) | Source of truth: stack rationale, 42-task breakdown, SDLC conventions      |
| [docs/](./docs/)                                           | Ops runbooks, compliance reviews, App Store material, per-session notes    |
| [CLAUDE.md](./CLAUDE.md)                                   | Guidance for Claude Code in this repo                                      |

## Stack

- **Mobile** — bare React Native (iOS Universal: iPhone + iPad), adaptive layouts, Zustand + NativeWind
- **Web** — Next.js (App Router), Tailwind, `@supabase/ssr`
- **Backend** — Supabase: Postgres + Row-Level Security + Auth + Edge Functions + Realtime
- **Monorepo** — pnpm workspaces (`apps/*`, `packages/*`); trunk-based git with squash-merge PRs

> Constraints (deliberate): no Expo/EAS, no npm/yarn, no `develop` branch. CocoaPods today; SPM migration is Phase 2.

## Quick start

```bash
pnpm install

# Backend (Docker required)
supabase start                                   # local Postgres + Auth + Edge Functions
supabase db reset                                # apply migrations 001–004

# Web
pnpm --filter web dev                            # http://localhost:3000

# Mobile
pnpm --filter mobile start                       # Metro
pnpm --filter mobile ios --simulator="iPhone 15 Pro"

# Quality gates (must pass before merge)
pnpm -r lint && pnpm -r typecheck && pnpm -r test
pnpm --filter web build
```

Copy `apps/web/.env.local.example` → `apps/web/.env.local` and `apps/mobile/.env.example` → `apps/mobile/.env`, filling values from `supabase status`. **Never put the service-role key in a client env file.**

## Status

Foundation complete: monorepo + CI, full schema (15 tables), RLS + atomic functions, kid-auth Edge Function, and parent-auth backend + web screens. Remaining v1 work (mobile parent-auth, navigation shells, kid login, and the chore/points/rewards/reading/savings surfaces) is tracked in the plan and session notes.
