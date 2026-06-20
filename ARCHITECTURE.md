# LootLoop — Architecture

LootLoop is a family chore & reward app. Two roles — **parent** (manages chores, rewards, approvals) and **kid** (completes chores, earns/spends points, reads, saves). This document describes the system as built; diagrams are [Mermaid](https://mermaid.js.org/) so they render on GitHub and stay version-controlled.

> Source of truth for the task breakdown and conventions: [`lootloop-technical-plan.md`](./lootloop-technical-plan.md). Session history: [`docs/session-notes/`](./docs/session-notes/).

---

## 1. System overview

A pnpm monorepo with two client apps and shared packages, backed by Supabase (Postgres + RLS + Auth + Edge Functions + Realtime). **Family isolation is enforced in the database via Row-Level Security — never in app code.** All money/state mutations run through atomic SQL functions, never client-side writes.

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

**Platform matrix (v1):** parent on iPhone/iPad/Web; kid on iPhone/iPad only (kid-on-web deferred). Web is the primary management surface.

---

## 2. Repository layout

```
lootloop/
├── apps/
│   ├── mobile/        bare React Native (iOS Universal; Android stub for Phase 2)
│   └── web/           Next.js App Router (parent dashboard; marketing in Phase 2)
├── packages/
│   ├── domain/        pure TS: interest, points, recurrence (heavily unit-tested)
│   ├── client/        Supabase client wrapper + auth helpers (shared)
│   └── types/         Supabase-generated TS types
├── supabase/
│   ├── migrations/    001_initial_schema → 004_auth_bootstrap
│   ├── functions/     kid-auth (+ interest, recurring-chores to come)
│   └── tests/         RLS + atomic-function + bootstrap SQL tests
├── design/            tokens, ui_kits, components, specs/
└── docs/              architecture + session notes
```

**Stack constraints (deliberate):** bare RN only (no Expo/EAS), pnpm only (no npm/yarn), trunk-based git (`main` + short-lived `feature/*` → squash-merge PRs). CocoaPods is in use today; SPM migration is a Phase 2 item.

---

## 3. Data model

15 family-scoped tables. **`families` is the isolation root** — every table carries a `family_id` that RLS keys on. Money/points are integers (never floats); balances are read-only to clients and move only through atomic functions. Ledgers (`point_transactions`, `savings_transactions`) are append-only.

```mermaid
erDiagram
  families ||--o{ profiles : "members"
  families ||--o{ chores : "defines"
  families ||--o{ rewards : "offers"
  families ||--o{ schedule_items : "schedules"
  families ||--o{ family_invites : "issues"

  profiles ||--o| wallets : "kid has 1"
  profiles ||--o| reading_streaks : "kid has 1"
  profiles ||--o{ chore_completions : "kid completes"
  profiles ||--o{ point_transactions : "kid ledger"
  profiles ||--o{ savings_transactions : "kid ledger"
  profiles ||--o{ savings_goals : "kid sets"
  profiles ||--o{ reading_logs : "kid logs"

  chores ||--o{ chore_instances : "materializes daily"
  chore_instances ||--o{ chore_completions : "completed via"
  rewards ||--o{ reward_purchases : "bought as"
  profiles ||--o{ reward_purchases : "kid buys"
  chore_completions ||--o{ point_transactions : "earn links"
  point_transactions |o--o| reward_purchases : "spend links"

  families {
    uuid id PK
    text name
  }
  profiles {
    uuid id PK
    uuid family_id FK
    profile_role role "parent | kid"
    text display_name
    uuid auth_user_id "parent: -> auth.users; kid: null"
    text pin_hash "kid only (bcrypt)"
    age_mode age_mode "kid: simple|detailed|teen"
  }
  wallets {
    uuid kid_id FK "unique"
    int wallet_balance ">= 0"
    int savings_balance ">= 0"
  }
  chores {
    uuid id PK
    int points
    chore_assignment assignment "assigned | shared"
    uuid assigned_kid_id FK
    text recurrence_rule "RRULE"
    bool active
  }
  chore_instances {
    uuid id PK
    uuid chore_id FK
    date due_date
    int points "snapshot"
  }
  chore_completions {
    uuid id PK
    uuid chore_instance_id FK
    uuid kid_id FK
    completion_status status "claimed|pending|approved|rejected"
    int awarded_points
  }
  point_transactions {
    uuid id PK
    uuid kid_id FK
    point_txn_type type "earn|bonus|spend|refund"
    int amount "signed"
    uuid chore_completion_id FK
  }
  rewards {
    uuid id PK
    int cost
    bool active
  }
  reward_purchases {
    uuid id PK
    uuid reward_id FK
    uuid kid_id FK
    int cost "snapshot"
    purchase_status status "purchased | given"
    uuid point_transaction_id FK
  }
  reading_logs {
    uuid id PK
    uuid kid_id FK
    text book_title
    int minutes
    reading_status status
  }
  reading_streaks {
    uuid kid_id FK "unique"
    int current_streak
    int longest_streak
  }
  savings_transactions {
    uuid id PK
    uuid kid_id FK
    savings_txn_type type "deposit|withdraw|interest"
    int amount "signed"
  }
  savings_goals {
    uuid id PK
    uuid kid_id FK
    text title
    int target
  }
  schedule_items {
    uuid id PK
    uuid kid_id FK
    time start_time
    smallint days_of_week "ISO 1-7"
  }
  family_invites {
    uuid id PK
    uuid family_id FK
    text code "8-char, single-use"
    timestamptz expires_at
    timestamptz used_at
  }
```

_Audit/provenance FKs (`reviewed_by`, `awarded_by`, `given_by`, `created_by`, `used_by` → `profiles`) are omitted from the diagram for clarity; all are `ON DELETE SET NULL` to preserve history. `family_id` is `ON DELETE CASCADE` everywhere._

**Enums:** `profile_role`, `age_mode`, `chore_assignment`, `completion_status`, `reading_status`, `purchase_status`, `point_txn_type`, `savings_txn_type`.

---

## 4. Security model

Two layers: **RLS** decides which rows a principal can read/select, and **atomic `SECURITY DEFINER` functions** perform every privileged mutation while authorizing the caller in-body.

### 4.1 Principal resolution

There are two kinds of authenticated principal, resolved to `(family_id, role, profile_id)` by helper functions so every policy is written once:

```mermaid
flowchart TD
  req["Request with JWT"] --> isk{"ll_role == 'kid' ?"}
  isk -- "yes (kid-auth token)" --> kid["claims: family_id, profile_id"]
  isk -- "no (Supabase Auth token)" --> par["auth.uid() → profiles.auth_user_id"]
  kid --> resolve["auth_family_id() / auth_role() / auth_profile_id()"]
  par --> resolve
  resolve --> rls["RLS: family_id = auth_family_id()<br/>+ role/ownership checks"]
```

- **Parents** are real `auth.users`; their JWT carries no custom claims.
- **Kids** are _not_ auth users — the `kid-auth` Edge Function mints a JWT with `ll_role='kid'`, `family_id`, `profile_id` (contract documented in `002_rls_policies.sql`).
- Read-only tables (`wallets`, the two ledgers, `reading_streaks`) have **no** client write privilege at all — so even a policy bug can't let a client write a balance.

### 4.2 Atomic functions (the only writers of money/state)

`SECURITY DEFINER`, pinned `search_path`, `FOR UPDATE` row locks, idempotent where relevant — and each **authorizes the caller** via the `auth_*()` helpers, because the client calls RPC directly (there is no trusted server in between):

| Function                   | Who may call                 | Guarantees                               |
| -------------------------- | ---------------------------- | ---------------------------------------- |
| `award_points_on_approval` | parent in family             | idempotent; no double-award              |
| `purchase_reward`          | owning kid or parent         | balance check; no overdraft/double-spend |
| `transfer_to_savings`      | owning kid or parent         | no overdraft either direction            |
| `credit_interest`          | `service_role` only (cron)   | atomic savings credit                    |
| `create_family_and_parent` | confirmed user w/ no profile | bootstrap; blocks re-bind                |
| `create_family_invite`     | parent                       | single-use, 7-day code                   |
| `join_family_as_parent`    | confirmed user w/ no profile | invite redemption (locked)               |

> **Convention:** any new RLS-bypassing function MUST self-authorize the caller and ship adversarial tests. See `supabase/tests/`.

---

## 5. Key flows

### 5.1 Parent signup → onboarding

```mermaid
sequenceDiagram
  participant U as Parent (web)
  participant A as Supabase Auth
  participant Mail as Mailpit / SMTP
  participant DB as Postgres (RLS)

  U->>A: signUp(email, password)
  A->>Mail: confirmation email
  U->>Mail: click confirm link
  Mail-->>U: /auth/callback?code
  U->>A: exchangeCodeForSession
  Note over U,DB: session exists, but no profile yet → onboarding
  alt Create a new family
    U->>DB: create_family_and_parent(name, displayName)
  else Join with invite code
    U->>DB: join_family_as_parent(code, displayName)
  end
  DB-->>U: family_id (+ parent profile)
  U->>U: middleware gate → dashboard
```

Route gating (Next.js middleware, `@supabase/ssr` cookie sessions): **no session → `/login`**, **session but no parent profile → `/onboarding`**, **onboarded → dashboard**.

### 5.2 Kid PIN login

```mermaid
sequenceDiagram
  participant K as Kid (mobile)
  participant E as kid-auth Edge Fn
  participant DB as Postgres
  participant R as PostgREST (RLS)

  K->>E: POST { family_id, profile_id, pin }
  E->>DB: select pin_hash (direct privileged conn)
  E->>E: bcrypt.compare (dummy compare if no kid — no leak)
  E-->>K: HS256 JWT { ll_role:'kid', family_id, profile_id }
  K->>R: queries/RPCs with the JWT
  R->>DB: auth_*() resolve kid → rows scoped to their family
```

### 5.3 Atomic operation (reward purchase)

```mermaid
sequenceDiagram
  participant K as Kid
  participant R as PostgREST
  participant F as purchase_reward() (SECURITY DEFINER)
  participant DB as Tables

  K->>R: rpc purchase_reward(reward_id, kid_id)
  R->>F: invoke as 'authenticated'
  F->>F: authorize caller (auth_family_id + owner/parent)
  F->>DB: lock wallet FOR UPDATE
  F->>DB: assert balance >= cost
  F->>DB: decrement wallet · insert 'spend' ledger · insert purchase
  F-->>K: purchase_id (single transaction)
```

---

## 6. Adaptive UI

Mobile is **adaptive, not separate apps**: one component tree branches at runtime.

```mermaid
flowchart LR
  comp["Screen component"] --> sc{"useSizeClass()"}
  sc -- iPhone --> stack["stack / tabs nav"]
  sc -- iPad --> split["split-view nav"]
  comp --> am{"useAgeMode() (kid)"}
  am -- "5–8" --> simple["Simple: big targets, icons"]
  am -- "9–12" --> detailed["Detailed: stats, progress"]
  am -- "13–15" --> teen["Teen: minimal gamification"]
```

State via Zustand; styling via NativeWind (mobile) / Tailwind (web). The service-layer boundary is `packages/client` — screens never touch the Supabase client directly or bypass RLS.

---

## 7. Deployment & environments

```mermaid
graph LR
  subgraph local["Local (today)"]
    dev["dev machine"] --> orb["OrbStack / Docker"] --> sb["supabase local stack"]
  end

  subgraph ci["CI — GitHub Actions"]
    pr["PR checks:<br/>lint · typecheck · test · build-web · mobile-typecheck (Node 22)"]
  end

  subgraph cloud["Cloud (when ready)"]
    vercel["Vercel — web"]
    sbcloud["Supabase cloud (dev/prod)"]
    tf["TestFlight — iOS (Fastlane)"]
  end

  feat["feature/* branch"] -->|open PR| pr
  pr -->|squash-merge| main["main"]
  main -.->|Phase 2| vercel
  main -.->|Phase 2| tf
  vercel --> sbcloud
```

| Env        | Supabase                  | Web            | Mobile             |
| ---------- | ------------------------- | -------------- | ------------------ |
| Local      | Docker (`supabase start`) | localhost:3000 | iOS sim / device   |
| Preview    | cloud (dev)               | Vercel preview | Fastlane `ios dev` |
| Production | cloud (prod)              | Vercel prod    | TestFlight         |

**Secrets discipline:** `.env` at repo root (server/shared), `apps/web/.env.local` (`NEXT_PUBLIC_*` only — safe in the client bundle), `apps/mobile/.env` (via `react-native-config`). **`SUPABASE_SERVICE_ROLE_KEY` and the JWT secret are never bundled into client builds.** CI supplies public placeholders for the web build.

---

## 8. Testing layers

- **Unit (Jest):** `packages/domain` + app `stores`/`hooks` (70% target). Supabase calls are mocked at the service boundary — not unit-tested.
- **Integration (SQL against local Supabase):** RLS isolation (cross-family, parent + kid), atomic-function edge cases, auth bootstrap — `supabase/tests/*.sql`, deterministic/rolled-back.
- **E2E (planned):** Maestro for iOS (one flow runs on iPhone + iPad), Playwright for web — 4–6 golden paths.

---

## 9. Current status

Built & merged: monorepo + tooling + CI; full schema (15 tables); RLS + atomic functions; kid-auth Edge Function; parent-auth backend + web screens. Remaining for v1: mobile parent-auth screens, adaptive nav shells, the kid PIN screen, then the chore/points/rewards/reading/savings feature surfaces. See [`docs/session-notes/`](./docs/session-notes/) and the project task list.
