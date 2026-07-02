---
title: Stack Decisions
description: The deliberate stack constraints and portability rules — what we chose, what we rejected, and why.
---

# Stack Decisions

These constraints are deliberate. If a task seems to call for one of the rejected options, stop and ask rather than reintroducing it.

## Constraints — do not reintroduce

### Bare React Native — no Expo / EAS

Mobile is bare RN 0.86 (React 19). Do not suggest `expo install`, `app.json`, or Expo modules. iOS native dependencies ship via **CocoaPods** today (`apps/mobile/ios/Podfile` + `Pods/`); run `pod install` from `apps/mobile/ios`. Migrating to Swift Package Manager is a Phase 2 backlog item — RN's SPM path isn't stable yet.

### twrnc — not NativeWind

Mobile styling is **twrnc**: a pure-JS Tailwind runtime. Import the shared instance from `apps/mobile/src/lib/tw.ts` and use `style={tw\`…\`}`/`tw.style(...)`, never a `className`prop. Tokens live in`apps/mobile/tailwind.config.js`.

NativeWind was rejected: v4 crashes on RN 0.86 / React 19 (css-interop + navigation context), and v5 requires `@expo/metro-config` plus the `expo` package — which the No-Expo rule forbids. (Web still uses Tailwind — v4 — normally.)

### pnpm only

pnpm workspaces only — no npm, no yarn. The repo pins `packageManager: pnpm@11.8.0`.

### Trunk-based git

`main` plus short-lived `feature/<milestone>/<name>` branches, squash-merged via PR. There is no `develop` branch.

## Portability rules

We're committed to Supabase for v1, but a few disciplines keep a future backend swap a contained change instead of a rewrite:

- **No raw `supabase` outside `packages/client`.** Screens, stores, and hooks import [service-layer](./service-layer.md) functions (e.g. `chores.list(...)`), never `supabase.from(...)` / `.rpc(...)` directly. `packages/client` is the only package that knows the backend exists — so swapping it for `fetch('/api/...')` later touches one package, not every screen.
- **`packages/domain` stays I/O-free.** Pure TS only (interest, points, recurrence). No Supabase, no `fetch`, no DB imports. Its purity is what makes it portable verbatim.
- **Atomic business logic lives in SQL functions, not client code.** These are plain Postgres functions — they survive a move to any Postgres host. Inline multi-step logic in the client does not.
