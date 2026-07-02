---
title: Local Development
description: Run the backend, web, mobile, quality gates, and this wiki locally.
---

# Local Development

Prerequisites: Node >=22, pnpm >=11, Docker (for the Supabase local stack), and Xcode for the iOS simulators. Run `pnpm install` from the repo root once to hydrate the workspace.

## Backend — Supabase

```bash
supabase start   # local Postgres + Auth + Edge Functions in Docker
```

This brings up the full stack (Postgres with RLS + atomic functions, Auth/GoTrue, Edge Functions, Mailpit for confirmation emails).

## Web — Next.js

```bash
pnpm --filter web dev     # http://localhost:3000
pnpm --filter web build
```

## Mobile — bare React Native

```bash
pnpm --filter mobile start                              # Metro bundler
pnpm --filter mobile ios --simulator="iPhone 15 Pro"
pnpm --filter mobile ios --simulator="iPad Pro (12.9-inch)"
```

Run both simulators when verifying — the app is adaptive (compact vs regular size class), so iPhone and iPad render different navigation shells.

## Quality gates

These must pass before merge:

```bash
pnpm -r lint
pnpm -r typecheck
pnpm -r test
```

For a single package/test: `pnpm --filter <pkg> test -- <pattern>`. Integration (SQL) tests run against the local Supabase Docker via `pnpm test:integration`. See [CI/CD](../operations/ci-cd.md) for what the pipeline enforces.

## Environment files

| File                  | Purpose                | Notes                                                   |
| --------------------- | ---------------------- | ------------------------------------------------------- |
| `.env` (repo root)    | Shared / server values | Never client-bundled                                    |
| `apps/web/.env.local` | Web config             | Only `NEXT_PUBLIC_*` keys are safe in the client bundle |
| `apps/mobile/.env`    | Mobile config          | Loaded via `react-native-config`                        |

**Never bundle `SUPABASE_SERVICE_ROLE_KEY` (or the JWT secret) into a client build.** Those are server/cron-only. See [Contributing](../contributing.md) for the secrets discipline in full.

## Running this wiki

The `docs-site/` Docusaurus site is its own pnpm workspace root (not a member of the repo-root workspace), so install it from inside that directory:

```bash
cd docs-site
pnpm install
pnpm start
```

`pnpm start` serves the docs with live reload; `pnpm build` produces the static site.
