---
title: Repo Tour
description: How the LootLoop pnpm monorepo is laid out and where the key entry points live.
---

# Repo Tour

LootLoop is a pnpm monorepo. The workspace globs (`pnpm-workspace.yaml`) are:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

So `apps/*` and `packages/*` are the only workspace members. The root `package.json` (`name: lootloop`, `private: true`, `packageManager: pnpm@11.8.0`, `engines.node >=22`) defines the repo-wide scripts (`lint`, `typecheck`, `test`, `build`, `format`, `test:integration`) — each fans out with `pnpm -r`.

## Top-level layout

```
lootloop/
├── apps/
│   ├── mobile/        bare React Native (iOS Universal — iPhone + iPad)
│   └── web/           Next.js App Router (parent dashboard + marketing)
├── packages/
│   ├── domain/        pure TS: interest, points, recurrence (heavily unit-tested)
│   ├── client/        Supabase service layer + auth helpers (shared)
│   └── types/         Supabase-generated DB types
├── supabase/
│   ├── migrations/    001…011 SQL (schema, RLS, atomic functions)
│   ├── functions/     Edge Functions (Deno)
│   └── tests/         RLS + atomic-function + bootstrap SQL tests
├── design/            tokens, ui_kits, components, specs
├── docs/              existing repo docs (session notes, ops, compliance, app-store)
├── docs-site/         this documentation wiki (Docusaurus)
├── ARCHITECTURE.md    system overview + reusable Mermaid diagrams
└── lootloop-technical-plan.md   task breakdown + conventions (source of truth)
```

## apps/mobile — bare React Native (iOS)

Bare RN 0.86 / React 19, no Expo. Styling is [twrnc](../architecture/frontend-mobile.md) (the `tw` instance in `apps/mobile/src/lib/tw.ts`), not NativeWind. Source lives under `apps/mobile/src/`:

- `navigation/` — `RootNavigator.tsx` (auth-gated root stack), `ParentShell.tsx` / `KidShell.tsx` (adaptive tabs vs split-view), `AuthStack.tsx`.
- `screens/` — parent and kid feature surfaces (`chores/`, `approvals/`, `rewards/`, `kid-store/`, `kid-reading/`, `kid-savings/`, …).
- `stores/` — Zustand session stores (`session.tsx`, `kidSession.tsx`).
- `hooks/` — `useSizeClass.ts`, `useAgeMode.ts`, `useRefetchOnForeground.ts`.
- `lib/` — `tw.ts` (twrnc), `supabase.ts`, `sentry.ts`.

iOS native deps ship via CocoaPods (`apps/mobile/ios/`).

## apps/web — Next.js App Router

Next.js 16 (`next: 16.2.9`) with React 19 and Tailwind v4. `apps/web/app/` uses route groups `(auth)`, `(dashboard)`, `(marketing)`; `apps/web/middleware.ts` gates routes on session + parent profile. Shared UI in `apps/web/components/`; Supabase browser/server clients in `apps/web/lib/supabase/`. See [Frontend — Web](../architecture/frontend-web.md).

## packages/domain — pure logic

I/O-free TypeScript: `interest.ts`, `points.ts`, `recurrence.ts`. No Supabase, no `fetch`. Its purity is what makes it portable.

## packages/client — Supabase service layer

The only package that imports `@supabase/supabase-js`. Every screen and store calls service functions here (`chores.ts`, `rewards.ts`, …) instead of touching the client directly. See [Service Layer](../architecture/service-layer.md).

## packages/types — generated DB types

`database.types.ts` is generated from the Supabase schema; the service layer and both apps type queries against `Database`. See the [data model](../backend/data-model.md).

## supabase/

`migrations/` (001–011), `functions/` (Deno [Edge Functions](../backend/edge-functions.md): `kid-auth`, `calculate-interest`, `generate-recurring-chores`, `family-roster`, `delete-account`), and `tests/` (SQL RLS + atomic-function tests). `config.toml` configures the local stack.

## docs-site — this wiki

`docs-site/` is a Docusaurus site. It is intentionally **not** a member of the repo-root workspace — those globs only cover `apps/*` and `packages/*`. Instead it is its **own** pnpm workspace root (`docs-site/pnpm-workspace.yaml`), installed from inside the directory (`cd docs-site && pnpm install`), keeping its dependency tree isolated from the app/package graph.
