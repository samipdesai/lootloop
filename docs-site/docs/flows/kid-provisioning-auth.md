---
title: Kid Provisioning & Auth Flow
description: End-to-end trace of onboarding a kid device with a family code and PIN, minting a kid JWT without a GoTrue session.
---

# Kid Provisioning & Auth Flow

Kids are not `auth.users` rows — there is no GoTrue session for them. Instead, a parent creates the family (which auto-generates a reusable `kid_code`) and adds each kid with a bcrypt-hashed PIN. A kid device learns the `kid_code` (QR / deep-link / typed), fetches the family roster, picks a profile, and PIN-logs-in. The `kid-auth` edge function is the trust boundary: it verifies the PIN over a direct DB connection and mints a short-lived HS256 JWT carrying the LootLoop claims that the RLS helpers read. Every subsequent kid read/write goes through a client built by `createKidClient` with that JWT as a static bearer header.

```mermaid
sequenceDiagram
    participant Parent as Parent device
    participant Kid as Kid device
    participant SVC as packages/client
    participant Roster as family-roster (edge fn)
    participant Auth as kid-auth (edge fn)
    participant DB as Postgres

    Parent->>DB: create family (kid_code auto-generated) + create_kid (bcrypt pin)

    Note over Parent,Kid: kid_code shared via QR / deep-link / typed
    Kid->>SVC: bindFamilyByCode(client, code)
    SVC->>Roster: functions.invoke('family-roster', {code})
    Roster->>DB: direct conn: lookup family + kids by kid_code
    Roster-->>Kid: {family_id, family_name, kids[]}

    Kid->>Kid: pick profile + enter PIN
    Kid->>SVC: signInKid(client, {family_id, profile_id, pin})
    SVC->>Auth: functions.invoke('kid-auth', {family_id, profile_id, pin})
    Auth->>DB: direct conn: load profile (id, family_id, role='kid')
    Auth->>Auth: bcrypt.compare(pin, pin_hash); identical 401 on any failure
    Auth-->>Kid: {access_token (HS256 JWT), profile}

    Kid->>SVC: createKidClient(url, anonKey, access_token)
    Note over Kid,SVC: JWT set as static Authorization header;<br/>auth persistence + refresh disabled
    Kid->>DB: all kid reads/writes via PostgREST [RLS via auth_*() claims]
```

## Steps

1. **Parent creates the family + kids.** Creating a family fires the `families_set_kid_code` trigger, which assigns a unique 8-char `kid_code` (`gen_unique_kid_code`, migration 005). The parent adds each kid via the `create_kid(display_name, pin, age_mode, …)` function, which bcrypt-hashes the PIN into `profiles.pin_hash`. See `supabase/migrations/005_kid_management.sql`.

2. **Kid device learns the code.** The `kid_code` is the bearer secret for onboarding. The kid device obtains it via QR, deep-link, or by typing it in. The code is reusable and parent-rotatable (`regenerate_family_code`).

3. **Fetch the roster.** `bindFamilyByCode(client, code)` (`packages/client/src/kidSession.ts`) invokes the `family-roster` edge function. Since anon cannot read `profiles`/`families` under RLS, the function opens a direct privileged Postgres connection, resolves the code (uppercased), and returns `{ family_id, family_name, kids[] }` (first names + avatars + age_mode). An unknown code returns a generic 404; an in-memory per-IP rate limit throttles brute force. See `supabase/functions/family-roster/index.ts`.

4. **Kid picks a profile and enters a PIN.** The device shows the roster; the kid taps their profile and types their PIN.

5. **PIN login.** `signInKid(client, {family_id, profile_id, pin})` invokes the `kid-auth` edge function. Over a direct DB connection it loads the profile scoped to `(id, family_id, role='kid')`, then runs `bcrypt.compare(pin, pin_hash)`. A bad PIN and a nonexistent kid return a **byte-identical 401** (`invalid_credentials`), with a dummy bcrypt compare on the miss path to blunt timing enumeration. See `supabase/functions/kid-auth/index.ts`.

6. **Mint the kid JWT.** On success `kid-auth` signs an HS256 JWT with claims matching the RLS contract (migration 002): `role='authenticated'`, `ll_role='kid'`, `family_id`, `profile_id`, `sub = profile_id`, `aud='authenticated'`, short `exp`. The signing key is the project's legacy HS256 JWT secret, resolved from `KID_AUTH_JWT_SECRET` (the `SUPABASE_` prefix is reserved, so an un-prefixed name is used). It returns `{ access_token, token_type, expires_in, profile }`.

7. **Build the kid client.** `createKidClient(url, anonKey, accessToken)` constructs a Supabase client with the JWT set as a static `Authorization: Bearer` header and GoTrue persistence/auto-refresh disabled (there is no session to persist or refresh). It also calls `client.realtime.setAuth(accessToken)` so Realtime events are delivered under RLS.

8. **Scoped reads/writes.** Every kid PostgREST/Realtime request carries the JWT; PostgREST treats the caller as the kid principal, and the `auth_role()` / `auth_family_id()` / `auth_profile_id()` helpers (migration 002) resolve the claims to enforce RLS on every table.

## See also

- [Auth & onboarding feature](../features/auth-onboarding.md)
- [Edge functions](../backend/edge-functions.md)
- [Security & RLS](../backend/security-rls.md)
