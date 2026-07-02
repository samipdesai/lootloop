---
title: System Architecture
description: The big picture — a pnpm monorepo of two clients and shared packages over a Supabase backend.
---

# System Architecture

LootLoop is a pnpm monorepo with two client apps and shared packages, backed by Supabase (Postgres + RLS + Auth + Edge Functions + Realtime).

```mermaid
graph TB
  subgraph clients["Clients"]
    iphone["iPhone — bare React Native"]
    ipad["iPad — bare React Native"]
    web["Web — Next.js (parent dashboard)"]
  end

  subgraph pkgs["packages/ (shared TS)"]
    domain["domain — pure logic<br/>(interest, points, recurrence)"]
    client["client — Supabase wrapper<br/>+ auth helpers"]
    types["types — generated DB types"]
  end

  subgraph supa["Supabase backend"]
    auth["Auth (GoTrue)"]
    rest["PostgREST"]
    edge["Edge Functions<br/>(kid-auth, interest, recurring-chores)"]
    rt["Realtime"]
    pg[("Postgres<br/>RLS + atomic functions")]
  end

  iphone --> client
  ipad --> client
  web --> client
  client --> domain
  client --> types

  web -->|email/password| auth
  iphone -->|PIN login| edge
  ipad -->|PIN login| edge
  client -->|RPC + queries| rest
  edge --> pg
  rest --> pg
  auth --> pg
  rt --> pg

  classDef store fill:#211E27,color:#fff
  class pg store
```

## Structure

- **Two clients:** bare React Native (`apps/mobile`, iOS Universal) and Next.js App Router (`apps/web`, the primary parent management surface). See [Frontend — Mobile](./frontend-mobile.md) and [Frontend — Web](./frontend-web.md).
- **Shared packages:** `packages/client` (the [service layer](./service-layer.md) — the only code that talks to Supabase), `packages/domain` (pure logic), `packages/types` (generated [DB types](../backend/data-model.md)).
- **Backend:** Supabase — Postgres with RLS + atomic functions, Auth (GoTrue), PostgREST, Edge Functions, Realtime.

## Two core principles

1. **Family isolation is enforced in the database via Row-Level Security — never in app code.** Every family-scoped table carries a `family_id`; RLS policies key on the caller's resolved family so a client can only ever read/write its own family's rows. See [Security & RLS](../backend/security-rls.md).
2. **All money/state mutations run through atomic SQL functions**, never client-side writes. Balances and ledgers are read-only to clients; awarding points, purchasing rewards, and moving savings each run in a single `SECURITY DEFINER` transaction that also authorizes the caller. See [Atomic Functions](../backend/atomic-functions.md).

## Platform matrix (v1)

| Role   | iPhone | iPad | Web                              |
| ------ | ------ | ---- | -------------------------------- |
| Parent | yes    | yes  | yes (primary management surface) |
| Kid    | yes    | yes  | no (deferred)                    |
