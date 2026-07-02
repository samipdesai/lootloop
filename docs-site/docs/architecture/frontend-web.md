---
title: Frontend — Web
description: The Next.js App Router parent dashboard — route groups, middleware session gating, components, and Tailwind.
---

# Frontend — Web

`apps/web` is a Next.js 16 App Router app (React 19), the primary parent management surface. It also serves the public marketing/legal pages.

## Route groups

Routes live under `apps/web/app/`, organized into three route groups:

- `(auth)` — login, signup, forgot/reset password, email confirm, and onboarding. Each screen has its own layout under `app/(auth)/layout.tsx`.
- `(dashboard)` — the signed-in parent surfaces: Home (`page.tsx`), `chores/`, `approvals/`, `rewards/`, `schedule/`, `kids/`, `family/`.
- `(marketing)` — public pages: `welcome`, `coming-soon`, `privacy`, `terms`.

The `/auth/callback` route (outside the groups) runs the OAuth/email code exchange.

## Middleware — session gating

`apps/web/middleware.ts` refreshes the Supabase session on every request (the standard `@supabase/ssr` cookie pattern) and gates routes by session + profile state:

- **Marketing/legal routes** (`/welcome`, `/coming-soon`, `/privacy`, `/terms`) bypass all auth gating.
- **No session:** public auth routes render directly; the apex `/` **rewrites** to `/welcome` (URL stays `/`); any other gated path redirects to `/login`.
- **Session, no parent profile:** forced to `/onboarding` from anywhere.
- **Fully onboarded:** auth routes bounce back to the dashboard (`/`).

`/reset-password` and `/auth/callback` are always allowed through regardless of session state. See [Auth & Onboarding](../features/auth-onboarding.md) for the full flow.

Profile state is resolved by querying `profiles` for a `parent` row bound to `auth_user_id` — via `@supabase/ssr` server clients in `apps/web/lib/supabase/` (`client.ts` for the browser, `server.ts` for server/middleware). All data access goes through the [service layer](./service-layer.md).

## Components & styling

Shared UI lives in `apps/web/components/`:

- `ui/` — primitives (`Button`, `Card`, `Input`, `PasswordInput`, `SegmentedTabs`, `Coin`, `ErrorBanner`, brand marks).
- `dashboard/` — dashboard chrome (`SidebarNav`, `BottomNav`, `nav-items`, `LogoutButton`).

Styling is **Tailwind v4** (`app/globals.css` + `postcss.config.mjs`). Error/crash monitoring is Sentry (`@sentry/nextjs`), wired via `instrumentation.ts` and `instrumentation-client.ts`.
