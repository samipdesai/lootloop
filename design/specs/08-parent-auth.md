# Spec — Task #8: Parent Auth (Signup + Login + Reset + Onboarding)

> **Role:** design-translator output. This is a _buildable spec_, not code. The web-screen-builder and mobile-screen-builder implement it.
> **Task:** #8 — Parent auth: signup + login + email-confirmation + password reset + create-or-join-family onboarding. Parent-only (kid auth is task #9, a separate mobile PIN flow — do **not** touch it here).
> **Platform scope (per plan matrix):** **web (Next.js App Router — primary management surface) AND mobile (bare RN, iPhone + iPad adaptive).** No kid surface.
> **Depends on:** #7 (Supabase client in `packages/client/`, already scaffolded). Soft-depends on #10 (`useSizeClass()`) — see [Size-class seam](#size-class-mobile).

---

## 0. Source mapping & honesty note

There is **no parent-auth mockup** in `design/`. `design/ui_kits/app/Onboarding.jsx` is the **kid** flow (welcome + 4-dot PIN pad) and must not be reused for parents. This spec is therefore **derived** from:

- `design/tokens/*` — palette, type, spacing, radii, shadows (the source of truth).
- `design/components/core/{Button,Input,Card,Badge,Tabs}.jsx` — the component contracts to reproduce in RN/web (`Tabs` backs the onboarding Create/Join segmented toggle).
- `design/ui_kits/app/Parent.jsx` + `Shell.jsx` — parent visual language (warm page bg, white cards, Baloo 2 headings, pill buttons with 3D bottom edge).
- `design/assets/looty.svg` (mascot) and `logomark.svg` — used as the auth-screen brandmark.

Where the derivation makes a layout choice the mockups don't dictate, it's called out as **[derived]**.

---

## 1. Resolved product decisions

The five questions this spec previously hedged on are now **answered**. Build to these — no defaults to confirm.

1. **Email confirmation: ON.** Signup does **not** return a session. Flow is: Signup → **Check-your-email interstitial** → (user clicks the emailed link) → **Login** → first login lands on **onboarding**. The "Check your email" screen is now a **required** screen, not conditional. See [§5.4](#54-check-your-email-interstitial). Locally, Supabase catches confirmation/reset emails in **Mailpit** at `http://127.0.0.1:54324` — that's where builders read the links during dev. Production SMTP is a deploy concern, **out of scope** for these screens.
2. **Password reset: IN v1.** Two new screens: **Forgot password** (request — email entry → "we sent a link" confirmation) and **Reset password** (new-password entry, reached from the emailed link). The login screen now shows a real `Forgot password?` ghost link. Seam: `supabase.auth.resetPasswordForEmail(email, { redirectTo })` to request, `supabase.auth.updateUser({ password })` to set the new one. See [§5.5](#55-forgot-password-request) and [§5.6](#56-reset-password-set-new). **Note the seam; do not implement it.**
3. **Create-OR-join family at onboarding.** After first confirmed login, a user with **no profile** is forced into onboarding offering **two paths**: (a) **Create a family** → `create_family_and_parent(name, display_name)`; (b) **Join a family** (enter an invite code) → `join_family_as_parent(code, display_name)`. Both RPCs are **backend-owned (db-architect)** — reference them, don't design the SQL. See [§5.3](#53-onboarding-create-or-join-family).
4. **Sign in with Apple / OAuth: DEFERRED — explicitly out of v1 scope.** Blocked on an Apple Developer account. Do **not** spec the OAuth flow. Login + Signup layouts must reserve a clearly-marked **placeholder slot** for the future Apple button (below the primary submit, above the footer link) — see [§5.1 OAuth placeholder slot](#oauth-placeholder-slot). Render nothing there in v1 (or a commented seam); no divider, no button.
5. **Min password length: 8** (client-side validation, signup + reset). See [§6](#6-validation-rules). Set the Supabase project's `Minimum password length` to 8 so server rules match the client.

---

## 2. Backend dependency — the family bootstrap seam

**This is the load-bearing architectural note for this task. Builders: do not try to `INSERT` into `families`/`profiles` from the client.**

RLS gives an anonymous-or-freshly-signed-up user **no INSERT privilege** on `families` or `profiles`, because those policies key off an _existing_ parent profile in the same family — a chicken-and-egg. The first family + first parent profile must be created under **elevated context**:

- **Mechanism (backend, owned by db-architect / edge-fn-eng — NOT this task):** two atomic `SECURITY DEFINER` SQL functions, **or** Edge Functions using the service role. Each reads `auth.uid()` from the JWT and runs in one transaction:
  - `create_family_and_parent(p_family_name text, p_display_name text)` → inserts the `families` row, then the parent `profiles` row linked to that family + `auth.uid()`. Returns `{ family_id }`.
  - `join_family_as_parent(p_invite_code text, p_display_name text)` → validates the invite code (exists / not expired / not already used), then inserts the parent `profiles` row linked to the **existing** family + `auth.uid()`. Returns `{ family_id }` or raises a typed error for invalid/expired/used codes (see [§8](#8-supabase-auth-error-copy-map)).
- **The client seam this task consumes:** after a confirmed first login with no profile, the onboarding screen calls **exactly one** of:
  - `supabase.rpc('create_family_and_parent', { p_family_name, p_display_name })`
  - `supabase.rpc('join_family_as_parent', { p_invite_code, p_display_name })`
    Each is a black box that returns `{ family_id }` or throws.
- **Idempotency / re-entry:** the confirmed user has a session but **no profile** until one RPC succeeds. The app must detect "session exists but no parent profile" and route into [onboarding](#53-onboarding-create-or-join-family), not the dashboard. See [§7 session-gating](#7-session--routing-gating).

> Builders: stub the RPC names above and wire the calls. If a function isn't merged yet, gate behind a TODO that throws a clear "bootstrap function not deployed" error — do **not** silently fake-create state.

---

## 3. Shared design language (applies to web + mobile)

| Token                  | Web (Tailwind v4 class)                                     | Mobile (NativeWind class)                             | Raw value           |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------- |
| Page background        | `bg-surface-page`                                           | `bg-surface-page`                                     | `#F8F5F1`           |
| Card surface           | `bg-surface-card`                                           | `bg-surface-card`                                     | `#FFFFFF`           |
| Card radius            | `rounded-card`                                              | `rounded-card`                                        | `24px`              |
| Card shadow            | `shadow-[0_8px_20px_rgba(32,36,58,0.10)]` (= `--shadow-md`) | RN `style` shadow (see [§4.3](#43-card-shadow-on-rn)) | —                   |
| Heading font           | `font-display` (Baloo 2)                                    | `font-display`                                        | Baloo 2 800         |
| Body font              | `font-sans` (Nunito)                                        | `font-sans`                                           | Nunito 600/700      |
| Primary text           | `text-ink-900`                                              | `text-ink-900`                                        | `#211E27`           |
| Muted text             | `text-ink-500`                                              | `text-ink-500`                                        | `#756E80`           |
| Brand / primary action | `bg-orange` (hover `bg-orange-strong`)                      | `bg-orange`                                           | `#F4720E`           |
| Link / focus           | `text-indigo-strong`                                        | `text-indigo-strong`                                  | `#444CCB`           |
| Error text             | `text-danger-ink`                                           | `text-danger-ink`                                     | `#B11216`           |
| Error field ring       | `ring-2 ring-danger`                                        | border `#E5484D`                                      | `#E5484D`           |
| Screen padding         | `px-5` (20px)                                               | `px-5`                                                | `--screen-pad` 20px |
| Card max width         | `max-w-[420px]`                                             | `max-w-[420px]`                                       | `--max-app` 420px   |

Both tailwind configs already define these tokens (`apps/web/app/globals.css` `@theme`, `apps/mobile/tailwind.config.js`). Use the named classes — do **not** hardcode hex.

### Core components to (re)use

The `design/components/core/*.jsx` files are HTML/`style`-prop references, not the actual app components. Build/consume framework-native equivalents that match their contract:

- **`Button`** — pill (`rounded-pill`), Baloo 2 700, has a **chunky 3D bottom edge** (`box-shadow: 0 4px 0 <strong>`) that depresses 2px on press. Variants used here: `primary` (orange) and `ghost` (transparent, `text-orange-strong`). Sizes: `lg` (h 56) for the main submit, `ghost`/`sm` for the mode-switch link. Props needed: `variant`, `size`, `block`, `disabled`, `loading` (see [loading state](#5-states)), `iconLeft`.
- **`Input`** — h 48, `rounded-lg` (22px), 2px inset ring (`--border` idle → `--indigo` focus + focus-ring glow → `--danger` on error), Nunito 600. Props: `label` (Nunito 700, 14px), `error` (renders `--danger-ink` caption under field), `hint`, `iconLeft`, `secureTextEntry`/`type="password"`, plus a password **show/hide** toggle (`suffix` slot — eye / eye-off icon).
- **`Card`** — white surface, `rounded-card`, `--shadow-md`. The auth form sits in one centered `Card` with `pad={24}`.

> Builders should check whether #8 is the first screen to need real `Button`/`Input` components. If so, create them under `apps/web/components/ui/` and `apps/mobile/src/components/ui/` matching the contract above; subsequent tasks reuse them. Keep them dumb/presentational.

---

## 4. Screen inventory

Six screens per platform:

| Screen                          | Web route                 | Mobile screen          | Purpose                                                                                                 |
| ------------------------------- | ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Log in**                      | `/(auth)/login`           | `LoginScreen`          | Email + password → session                                                                              |
| **Sign up**                     | `/(auth)/signup`          | `SignupScreen`         | Email + password → creates the auth account (no session; email confirmation required)                   |
| **Check your email**            | `/(auth)/confirm`         | `ConfirmEmailScreen`   | Post-signup interstitial: "click the link we emailed you"                                               |
| **Forgot password**             | `/(auth)/forgot-password` | `ForgotPasswordScreen` | Email entry → "we sent a reset link" confirmation                                                       |
| **Reset password**              | `/(auth)/reset-password`  | `ResetPasswordScreen`  | New-password entry, reached from the emailed reset link                                                 |
| **Onboarding (create or join)** | `/(auth)/onboarding`      | `OnboardingScreen`     | First confirmed login, no profile: branch into Create-a-family or Join-a-family → calls a bootstrap RPC |

Navigation edges:

- **Log in ↔ Sign up** via ghost-link footers.
- **Log in → Forgot password** via a `Forgot password?` ghost link by the password field.
- **Sign up → Check your email** (automatic on signup success). Check-your-email has a `Back to log in` ghost link.
- **Reset password** and **Check your email** confirmation links are opened from the email client; on web they land on a callback route ([§5.4](#54-check-your-email-interstitial) / [§5.6](#56-reset-password-set-new)). They are **not** directly navigable from inside the app.
- **Onboarding** is reachable **only** when a confirmed session exists with no profile (see [re-entry gating](#7-session--routing-gating)); not directly navigable, no footer link.

---

## 5. Shared screen anatomy & states

All six screens share one layout skeleton (**[derived]** from `Parent.jsx`/`Shell.jsx` visual language). Screens with no form (Check-your-email) omit the `<form>`/Input rows but keep the brandmark + Card + a primary/ghost action stack:

```
[surface-page background]
  └─ centered column, max-w-420, vertical-centered on viewport
       ├─ Brandmark   (looty.svg ~96px  OR logomark.svg) + wordmark "LootLoop" (Baloo 2 800, 32px)
       ├─ Card (pad 24, shadow-md, rounded-card)
       │    ├─ Title       (Baloo 2 800, 26px / --fs-h2)  e.g. "Welcome back"
       │    ├─ Subtitle     (Nunito 600, 16px, text-ink-500)
       │    ├─ <form>  fields stacked, gap 16 (--space-4)
       │    │    └─ Input(s) + inline field errors
       │    ├─ form-level error banner (conditional — see below)
       │    └─ Button primary lg block  (submit; shows spinner when loading)
       └─ footer ghost-link to the other screen
```

### 5.1 Screen-specific content

**Log in (`LoginScreen` / `/login`)**

- Title: `Welcome back`. Subtitle: `Log in to manage your family.`
- Fields: Email (`type=email`, `autoComplete=email`/`textContentType=emailAddress`, `keyboardType=email-address`, autoCapitalize off), Password (`secureTextEntry`/`type=password`, `autoComplete=current-password`, show/hide toggle).
- **`Forgot password?`** ghost link, right-aligned directly under the password field (Nunito 700, `text-indigo-strong`, `--fs-caption` 13px) → `/forgot-password`.
- Submit: `Log in`.
- [OAuth placeholder slot](#oauth-placeholder-slot) (empty in v1).
- Footer: `New here? ` + ghost link `Create an account` → signup.

**Sign up (`SignupScreen` / `/signup`)**

- Title: `Create your account`. Subtitle: `Start managing chores & rewards.`
- Fields: Email, Password (`autoComplete=new-password`, `textContentType=newPassword`, show/hide). Password field shows the rule as a `hint`: `At least 8 characters.`
- _(No confirm-password field — show/hide toggle covers typo risk; keep it simple.)_
- Submit: `Create account`.
- [OAuth placeholder slot](#oauth-placeholder-slot) (empty in v1).
- Footer: `Already have an account? ` + ghost link `Log in` → login.
- On submit: call `supabase.auth.signUp(...)`. Because **email confirmation is ON**, this returns **no session** → route to [Check your email](#54-check-your-email-interstitial) (pass the entered email through). Do **not** route to onboarding from here.

#### OAuth placeholder slot {#oauth-placeholder-slot}

Sign in with Apple / OAuth is **deferred — out of v1 scope** ([§1.4](#1-resolved-product-decisions)). Reserve a layout slot **between the primary submit button and the footer ghost link** on **both** Login and Signup. In v1 render **nothing** in it (an empty container or an HTML/JSX comment marking the seam, e.g. `{/* OAuth: Sign in with Apple — deferred, see spec §1.4 */}`). Do **not** add a divider ("or"), the Apple button, or any social affordance now. **[derived]** — exact Apple button styling will be specced when the Apple Developer account lands.

**Check your email** — see [§5.4](#54-check-your-email-interstitial).
**Forgot password** — see [§5.5](#55-forgot-password-request).
**Reset password** — see [§5.6](#56-reset-password-set-new).
**Onboarding (create or join)** — see [§5.3](#53-onboarding-create-or-join-family).

### 5.2 States (every form — no blank screens)

| State                    | Trigger                           | UI                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initial / empty**      | Screen mount                      | Fields empty with placeholders; submit **disabled** until required fields non-empty AND client-valid. Brandmark + card visible immediately (no spinner — these screens have no data fetch).                                                                                                             |
| **Validating (inline)**  | Blur / on-change after first blur | Field shows red ring + `--danger-ink` caption (see [§6](#6-validation-rules)). Submit stays disabled while any field invalid.                                                                                                                                                                           |
| **Submitting (loading)** | Submit pressed, request in flight | Submit button → `loading`: replace label with a spinner (or keep label + leading spinner), button `disabled`, all inputs `disabled`/non-editable. Prevent double-submit. No full-screen overlay.                                                                                                        |
| **Error (form-level)**   | Request rejected                  | Inline banner **above** the submit button: `bg-danger-soft rounded-md px-4 py-3`, `text-danger-ink`, Nunito 700, with a small `alert-triangle`/`circle-alert` icon. Copy from [§8 error map](#8-supabase-auth-error-copy-map). Button returns to idle; inputs re-enabled; entered values **preserved**. |
| **Success**              | Request resolved                  | See per-screen success routing below. Briefly keep button in loading until navigation commits (avoids a flash of idle form).                                                                                                                                                                            |

### 5.3 Onboarding — create or join family {#53-onboarding-create-or-join-family}

First confirmed login with **no profile** forces this screen ([§7](#7-session--routing-gating)). It is **not** a single form — it offers **two paths** via a top toggle, and the visible fields/submit change per path.

**Shared chrome**

- Brandmark: `looty.svg` (~96px) with the mascot drop-shadow from Onboarding.jsx (`drop-shadow(0 12px 24px rgba(240,179,21,0.45))`) **[derived]** — the celebratory first-run moment.
- Title: `You're in! 🎉`. Subtitle: `Create a family, or join one you've been invited to.`
- **Path toggle** (top of the card): a 2-segment control — `Create a family` | `Join a family` — built on the `Tabs`/segmented contract (`design/components/core/Tabs.jsx`). Default segment: **Create a family**. Switching segments swaps the field set and submit label; **clears the inactive path's errors** but may preserve the shared `Your name` value. **[derived]** — no mockup; segmented toggle chosen over two separate screens to keep one onboarding route.
- **`Your name`** field is shown in **both** paths (`label="Your name"`, placeholder `e.g. Mom, Dad, Sam`, max 30 chars, required) — becomes the parent profile display name.
- **No footer link** (post-auth). The header shows a `Log out` ghost link so a user can abandon onboarding.

**Path A — Create a family** (default)

- Extra field: `Family name` (`label="Family name"`, placeholder `The Desai Family`, max 40 chars, required).
- Submit: `Create family`.
- On submit: `supabase.rpc('create_family_and_parent', { p_family_name, p_display_name })` ([§2](#2-backend-dependency--the-family-bootstrap-seam)) → on success route to dashboard.

**Path B — Join a family**

- Extra field: `Invite code` (`label="Invite code"`, placeholder `e.g. LOOT-7F3K`, required). `autoCapitalize="characters"`, `autoCorrect=false`; trim + upper-case before sending **[derived — confirm code format/casing with db-architect]**.
- Subtitle hint under the field: `Ask the parent who invited you for the code.`
- Submit: `Join family`.
- On submit: `supabase.rpc('join_family_as_parent', { p_invite_code, p_display_name })` → on success route to dashboard. Invalid / expired / already-used codes surface as **form-level errors** with the copy in [§8](#8-supabase-auth-error-copy-map); entered values preserved, stay on the Join segment.

All form states from [§5.2](#52-states-every-form--no-blank-screens) apply per active path: initial (submit disabled until that path's required fields valid), inline validation, submitting (lock + spinner), form-level error, success (route to dashboard).

### 5.4 Check-your-email interstitial {#54-check-your-email-interstitial}

Shown automatically after **signup success** (no session, because confirmation is ON). Same skeleton, **no form**:

- Brandmark + Card. Title `Check your email`. Body: `We sent a confirmation link to {email}. Click it to finish setting up your account.` (`{email}` is the just-entered address, passed in via route param/state — **[derived]** fallback copy `to your inbox` if it's somehow absent.)
- Secondary ghost button `Resend email` (calls `supabase.auth.resend({ type: 'signup', email })`), with a **30s cooldown** (button disabled + countdown label `Resend in 28s…`) and a transient `Sent!` confirmation on success. Resend errors surface inline via [§8](#8-supabase-auth-error-copy-map).
- Ghost link `Back to log in` → `/login`.
- **Dev note:** the confirmation email is caught locally by **Mailpit** (`http://127.0.0.1:54324`); builders click the link there. Prod SMTP is out of scope.
- **Web callback:** the email link lands on `/(auth)/callback`, which exchanges the code for a session (`supabase.auth.exchangeCodeForSession`) and then routes by profile state → **`/onboarding`** (no profile yet on a fresh confirm). Flag this callback route to web-screen-builder. **Mobile:** confirmation deep-link handling is owned by #10's linking config; this screen just needs the session-gate ([§7](#7-session--routing-gating)) to pick up the session once confirmed and route into onboarding.

### 5.5 Forgot password — request {#55-forgot-password-request}

Reached from the Login screen's `Forgot password?` link. Same skeleton, single-field form:

- Title: `Reset your password`. Subtitle: `Enter your email and we'll send a reset link.`
- Field: `Email` (same attributes as login email).
- Submit: `Send reset link`.
- Footer ghost link: `Back to log in` → `/login`.
- **Seam (note only — do not implement):** `supabase.auth.resetPasswordForEmail(email, { redirectTo: <reset-password URL> })`. On web, `redirectTo` is the `/(auth)/reset-password` route (via the `/(auth)/callback` exchange); on mobile it's the reset deep link (linking config owned by #10).
- **Success state:** swap the form for a confirmation panel **in place** (same card): icon + `Check your email`, body `If an account exists for {email}, we've sent a password reset link.` — neutral copy that **does not reveal whether the email is registered** (avoid account enumeration). Keep the `Back to log in` link. **[derived]** — privacy-preserving copy chosen deliberately.
- All form states from [§5.2](#52-states-every-form--no-blank-screens) apply (initial/validation/submitting/error/success). Note: because of the neutral-copy choice, a "no such user" outcome still shows the **success** panel, not an error; only true failures (network/rate-limit) show the form-level error banner.

### 5.6 Reset password — set new {#56-reset-password-set-new}

Reached **only** from the emailed reset link (web `/(auth)/reset-password` after the callback establishes a recovery session; mobile via deep link). Same skeleton, form:

- Title: `Set a new password`. Subtitle: `Choose a new password for your account.`
- Field: `New password` (`secureTextEntry`/`type=password`, `autoComplete=new-password`, show/hide toggle, `hint`: `At least 8 characters.`). _(No confirm field — show/hide covers typos; matches signup.)_
- Submit: `Save new password`.
- **Seam (note only — do not implement):** `supabase.auth.updateUser({ password })`, which works because the recovery link established a temporary session.
- **States** (all of [§5.2](#52-states-every-form--no-blank-screens)) **plus two reset-specific cases:**
  - **Invalid / expired link (no recovery session on mount):** if the screen loads without a valid recovery session, show a **non-form error panel** instead of the field: `This reset link is invalid or expired.` + ghost link `Request a new link` → `/forgot-password`. **[derived]**
  - **Success:** show `Password updated 🎉` confirmation + primary button `Go to log in` → `/login` (the recovery session is intentionally not treated as a full login; user re-authenticates). **[derived]** — confirm with builders whether to auto-redirect after a short delay vs. an explicit button; spec uses an explicit button.

### 5.7 Success routing (summary)

- **Login success** → session set. Route by profile state: parent profile exists → **dashboard** (`/(dashboard)/app` web / Parent shell mobile, owned by #10). No profile (confirmed but never finished onboarding) → **`/onboarding`**.
- **Signup success** → **no session** (confirmation ON) → **`/confirm`** ([§5.4](#54-check-your-email-interstitial)).
- **Email confirmed** (via callback/deep link) → session set, no profile → **`/onboarding`**.
- **Onboarding success** (either RPC returns `family_id`) → **dashboard**.
- **Forgot-password request success** → in-place confirmation panel ([§5.5](#55-forgot-password-request)); no navigation.
- **Reset-password success** → `Password updated` panel → `/login` ([§5.6](#56-reset-password-set-new)).

---

## 6. Validation rules

Client-side, before hitting the network. Validate on blur (first time) then on change.

| Field                             | Rule                                                                    | Error copy                     |
| --------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| Email                             | Non-empty; matches a basic email regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) | `Enter a valid email address.` |
| Password (login)                  | Non-empty                                                               | `Enter your password.`         |
| Password (signup)                 | ≥ 8 chars                                                               | `Use at least 8 characters.`   |
| Email (forgot password)           | Same as Email above                                                     | `Enter a valid email address.` |
| New password (reset)              | ≥ 8 chars                                                               | `Use at least 8 characters.`   |
| Family name (onboarding · Create) | Non-empty, ≤ 40 chars, trimmed                                          | `Give your family a name.`     |
| Invite code (onboarding · Join)   | Non-empty, trimmed                                                      | `Enter your invite code.`      |
| Your name (onboarding · both)     | Non-empty, ≤ 30 chars, trimmed                                          | `Enter your name.`             |

Submit button is enabled only when the **active path's** visible fields pass. Trim email + names + invite code before sending; never trim passwords.

---

## 7. Session & routing gating

The auth screens are reachable **only when logged out** (or logged-in-without-profile). Implement a small gate (builders wire to #10's navigator; this task only needs the seam):

- **No session** → may view `/login`, `/signup`, `/forgot-password`, and the `/(auth)/callback` route; visiting `/onboarding` redirects to `/login`. `/reset-password` is viewable only with a **recovery session** (from the reset link); without one it shows its invalid-link panel ([§5.6](#56-reset-password-set-new)).
- **Session, no parent profile** → force `/onboarding` from anywhere (the bootstrap-incomplete / freshly-confirmed re-entry case from [§2](#2-backend-dependency--the-family-bootstrap-seam)). Exception: a **recovery session** on `/reset-password` is not treated as a full login — let the reset screen render.
- **Session + parent profile** → auth routes redirect to dashboard.

Profile presence is checked by selecting the caller's `profiles` row (RLS-scoped to `auth.uid()`); absence = needs onboarding. **[derived]** — confirm the exact profiles query column names with db-architect (#5/#6).

**Web specifics:** put the screens under an `app/(auth)/` route group with its own minimal `layout.tsx` (centered, no dashboard chrome), plus the `/(auth)/callback` exchange route. The gate is best done in middleware or a server component reading the Supabase session cookie. Forms are **client components** (`'use client'`) calling `supabase.auth.signInWithPassword` / `signUp` / `resetPasswordForEmail` / `updateUser` from `apps/web/lib/supabase.ts`.

**Mobile specifics:** the screens live in an unauthenticated stack rendered by RootNavigator (#10) when no session/profile. Confirmation + reset deep links are handled by #10's linking config (flag the two link targets — confirm → onboarding, reset → reset-password — to #10). Use the shared client (consumed via `@lootloop/client`, configured in `apps/mobile/src/config/env.ts`). Persist the session (Supabase RN needs `AsyncStorage` storage adapter + `autoRefreshToken` — flag to mobile-screen-builder if the client wrapper in `packages/client` doesn't yet pass a storage adapter; #7 may need a follow-up).

---

## 8. Supabase Auth error → copy map

Map raw Supabase errors to friendly, parent-appropriate copy. Match on `error.message` / `error.status` / `error.code` (use `code` where available — newer supabase-js exposes `error.code`).

| Situation                                     | Supabase signal                                               | Form-level copy shown                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong email/password (login)                  | `code: invalid_credentials` / msg `Invalid login credentials` | `That email or password doesn't match. Try again.`                                                                                       |
| Email already registered (signup)             | `code: user_already_exists` / msg `User already registered`   | `That email already has an account. Log in instead?` (append a ghost link to `/login`)                                                   |
| Email not confirmed (login — confirmation ON) | `code: email_not_confirmed`                                   | `Confirm your email first — check your inbox for the link.` (+ a `Go to Check your email` / `Resend` ghost action routing to `/confirm`) |
| Weak password (signup/reset, server-side)     | `code: weak_password` / status 422                            | `That password is too weak. Use at least 8 characters.`                                                                                  |
| Reset link invalid/expired (reset-password)   | no recovery session on mount / `code: otp_expired`            | `This reset link is invalid or expired.` (+ `Request a new link` → `/forgot-password`) — see [§5.6](#56-reset-password-set-new)          |
| Update password failed (reset, server-side)   | `updateUser` throws                                           | `Couldn't update your password. Try again.` (keep entered value)                                                                         |
| Invalid invite code (onboarding · Join)       | `join_family_as_parent` raises invalid-code                   | `That invite code isn't valid. Double-check it with the parent who invited you.`                                                         |
| Expired invite code (onboarding · Join)       | raises expired-code                                           | `That invite code has expired. Ask for a new one.`                                                                                       |
| Already-used invite code (onboarding · Join)  | raises used-code                                              | `That invite code has already been used.`                                                                                                |
| Rate limited                                  | status 429 / `code: over_request_rate_limit`                  | `Too many tries. Wait a minute and try again.`                                                                                           |
| Network / fetch failed                        | thrown `TypeError`/`AuthRetryableFetchError`, no `status`     | `Can't reach LootLoop. Check your connection and try again.`                                                                             |
| Bootstrap RPC failed (onboarding · Create)    | `create_family_and_parent` throws (PostgREST error)           | `Couldn't set up your family. Try again.` (keep entered family/name values; allow retry)                                                 |
| Anything else                                 | fallback                                                      | `Something went wrong. Please try again.`                                                                                                |

Builders: centralize this in one `mapAuthError(error): string` helper per app (or shared in `packages/client`) so web + mobile copy stays identical. The three invite-code errors rely on the RPC raising **typed/distinguishable** errors (e.g. `PGRST`/`raise` with a stable code or `errcode`); **confirm the exact error discriminators with db-architect** so they don't all collapse to the generic fallback. **[derived copy — user may tune wording.]**

---

## 9. Size-class & adaptive layout

### Web (responsive)

Single responsive page; no separate layouts.

- **Mobile width (< `sm` 640px):** card is full-bleed-ish — `w-full px-5`, brandmark above, vertically centered.
- **≥ `sm`:** card `max-w-[420px]` centered on the viewport (`min-h-screen flex items-center justify-center`). Background `bg-surface-page`. **[derived]** Optional: on `lg+`, a two-pane split — left brand panel (orange-soft wash + Looty + one-line value prop), right the auth card — but this is **nice-to-have, not required for #8**. Default to the single centered card.

### Size-class (mobile) {#size-class-mobile}

LootLoop mobile is adaptive — **one component tree** branching on `useSizeClass()` (hook owned by #10; if not yet merged, branch on `useWindowDimensions()` width with a 768px threshold as an interim and leave a TODO to swap to `useSizeClass()`).

| Aspect        | iPhone (compact)                                                                                                                                                                                                              | iPad (regular)                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container     | Full-width column, `px-5`, content vertically centered with `flex-1 justify-center`. Card may be **borderless/flat** (`shadow-none`, no card bg) so fields sit directly on the page — typical iPhone auth feel. **[derived]** | Centered `Card` (`max-w-[420px]`, `shadow-md`, `rounded-card`, `pad 24`) floating on `surface-page`, with **more vertical chrome**: larger brandmark (Looty ~120px), title `--fs-h1` (32px). Generous top/bottom breathing room. |
| Brandmark     | Looty ~80px or wordmark only                                                                                                                                                                                                  | Looty ~120px                                                                                                                                                                                                                     |
| Keyboard      | `KeyboardAvoidingView` (`behavior="padding"`), scrollable so submit stays reachable                                                                                                                                           | Same; card stays centered, avoid jump                                                                                                                                                                                            |
| Submit button | `block` full-width                                                                                                                                                                                                            | `block` but constrained to the 420 card width                                                                                                                                                                                    |

Derivation rule honored: the iPad layout is the "more chrome / floating card" variant; the iPhone layout is **derived** by collapsing the card to a flat, full-width, vertically-centered stack. Both render from the same `<AuthScreen>` component with a `sizeClass` branch around the container wrapper only — fields/Button/error are identical.

---

## 10. Accessibility & input hygiene

- Inputs: correct `keyboardType`/`type`, `autoComplete`/`textContentType`, `autoCapitalize="none"` + `autoCorrect={false}` on email/password.
- Password show/hide toggle has an `aria-label`/`accessibilityLabel` (`Show password` / `Hide password`).
- Form-level error banner: `role="alert"` (web) / `accessibilityLiveRegion="polite"` (RN) so it's announced.
- Submit reachable above keyboard on small screens (web: ensure no fixed overlap; mobile: `KeyboardAvoidingView`).
- Min 44px tap targets (already met by `--control-h` 48 / lg 56).
- Tab order web: email → password → (show/hide) → submit → footer link. Enter submits the form.
- Onboarding path toggle: use `role="tablist"`/`role="tab"` (web) / `accessibilityRole="tab"` + `accessibilityState={{ selected }}` (RN); switching segments moves focus to the first field of the newly active path.
- The OAuth placeholder slot ([§5.1](#oauth-placeholder-slot)) renders nothing in v1, so it introduces no focusable element and no tab-order change.

---

## 11. Definition of done for #8 (design-conformance checklist)

- [ ] All six screens (Login, Signup, Check-your-email, Forgot-password, Reset-password, Onboarding) render on **iPhone sim, iPad sim, and web** with no blank/placeholder states.
- [ ] Every form covers: initial(disabled submit) · inline validation · submitting(spinner, locked) · form-level error(preserved input) · success(route/panel). Non-form screens (Check-your-email; Forgot/Reset success & invalid-link panels) render their states too.
- [ ] Happy path end-to-end against local Supabase: **Signup → Check-your-email → (confirm via Mailpit link) → Login → Onboarding (Create) → dashboard**, using `create_family_and_parent`.
- [ ] Join path: Onboarding (Join) with a valid invite code → dashboard via `join_family_as_parent`; invalid/expired/used codes show the distinct copy from [§8](#8-supabase-auth-error-copy-map).
- [ ] Password reset round-trip: Forgot-password → Mailpit link → Reset-password → `Password updated` → Login. Invalid/expired reset link shows the invalid-link panel.
- [ ] Re-entry case (confirmed session, no profile) lands on Onboarding, not a broken dashboard.
- [ ] OAuth placeholder slot present (empty) on Login + Signup; no Apple button, no divider shipped in v1.
- [ ] All Supabase auth errors from [§8](#8-supabase-auth-error-copy-map) surface friendly copy (verify at least invalid-credentials, email-taken, invalid invite code, network).
- [ ] Tokens only — no hardcoded hex; `Button`/`Input`/`Card`/`Tabs` match the design-system contract.
- [ ] iPhone (flat stack) vs iPad (centered card + more chrome) both correct from one component tree.
- [ ] No kid surfaces touched; Onboarding.jsx PIN flow untouched.
