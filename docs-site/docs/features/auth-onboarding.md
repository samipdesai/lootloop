---
title: Auth & Onboarding
description: Two auth models — parents use Supabase Auth (email/password); kids use a PIN with a minted JWT and no GoTrue session.
---

# Auth & Onboarding

## What it does

LootLoop has **two distinct auth models**, one per role:

- **Parent** — a real Supabase Auth (GoTrue) account with email/password. On first sign-up a parent either creates a new family or joins an existing one via a co-parent invite.
- **Kid** — no GoTrue account. A kid signs in with a PIN against a roster reached through the family's `kid_code`. A trusted edge function verifies the PIN and mints a JWT carrying a kid principal claim; the client then attaches that token as a static bearer header. There is no session to persist or refresh.

## Data

Tables (`supabase/migrations/`, see [data model](../backend/data-model.md)):

- **`profiles`** — parent and kid profiles (`profile_role` enum), including kid `pin` and `age_mode`.
- **`families`** — one per family, holds the unique `kid_code`.
- **`family_invites`** — pending co-parent invites.

## Backend operations

Onboarding and family management run through SECURITY DEFINER functions (see [atomic functions](../backend/atomic-functions.md)):

- **Parent onboarding** — `create_family_and_parent`, `create_family_invite`, `join_family_as_parent`.
- **Kid management** — `create_kid`, `update_kid`, `set_kid_pin`, `delete_kid`, `regenerate_family_code`.
- **Family teardown** — `leave_family`, `delete_family`.

Edge functions (see [edge functions](../backend/edge-functions.md)):

- **`family-roster`** — `POST { code } → { family_id, family_name, kids }`. Turns a family kid_code into a roster (pre-auth).
- **`kid-auth`** — `POST { family_id, profile_id, pin } → mints a kid JWT` on a valid PIN; 401 otherwise.
- **`delete-account`** — account/family deletion (Apple-required teardown).

## Service layer

- `packages/client/src/auth.ts` — `signUpParent`, `signInParent`, `signOut`, `requestPasswordReset`, `updatePassword`, plus RPC wrappers `createFamilyAndParent`, `createFamilyInvite`, `joinFamilyAsParent`, and `mapAuthError`.
- `packages/client/src/kidSession.ts` — `bindFamilyByCode` (calls `family-roster`), `signInKid` (calls `kid-auth`), `createKidClient(url, anonKey, accessToken)` (builds the bearer-header client every kid read/write goes through).
- `packages/client/src/kids.ts` — `listKidsWithBalances`, `createKid`, `updateKid`, `setKidPin`, `deleteKid`, `regenerateFamilyCode`, `getFamilyCode`.
- `packages/client/src/family.ts` — `listParents`, `listPendingInvites`, `revokeInvite`.
- `packages/client/src/account.ts` — `leaveFamily`, `deleteFamily`.
- `packages/client/src/pwned.ts` — `checkPasswordPwned` (k-anonymity password-breach check against the HaveIBeenPwned range API; `sha1Hex` helper) run during parent sign-up.

## UI

- **Parent (web + mobile):** web sign-in/onboarding is gated by middleware (see [web frontend](../architecture/frontend-web.md)); family management at `apps/web/app/(dashboard)/kids/` and `apps/web/app/(dashboard)/family/`, and `apps/mobile/src/screens/auth/`, `apps/mobile/src/screens/kids/`, `apps/mobile/src/screens/family/` (see [mobile frontend](../architecture/frontend-mobile.md)).
- **Kid (mobile only):** `apps/mobile/src/screens/kid-login/`.

## See also

- [Kid provisioning & auth flow](../flows/kid-provisioning-auth.md)
