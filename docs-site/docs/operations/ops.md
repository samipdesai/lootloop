---
title: Operations & runbooks
description: Where the operational, compliance, and app-store runbooks live and what they cover.
---

# Operations & runbooks

Operational runbooks, compliance reviews, and App Store material live as Markdown in the **main repo** under [`/docs`](https://github.com/samipdesai/lootloop/tree/main/docs) — that tree is the source of truth. This page indexes them so they are discoverable from the wiki; when a runbook changes, edit the file in `/docs`, not a copy here.

## Runbooks (`docs/ops/`)

- **[Database backup & restore](https://github.com/samipdesai/lootloop/blob/main/docs/ops/db-backup-restore.md)** — how backups are taken and restored. Automated snapshots run via the `db-backup` GitHub Actions workflow (see [CI/CD](./ci-cd.md)).
- **[Supabase JWT keys](https://github.com/samipdesai/lootloop/blob/main/docs/ops/supabase-jwt-keys.md)** — JWT signing key management, including the kid-auth signing secret. Note: kid-auth signs with `KID_AUTH_JWT_SECRET` (the `SUPABASE_` prefix is reserved), covered in [edge functions](../backend/edge-functions.md).

## Compliance (`docs/compliance/`)

- **[COPPA / kids-data review](https://github.com/samipdesai/lootloop/blob/main/docs/compliance/coppa-kids-data-review.md)** — children's-data handling review.
- **[Security audit](https://github.com/samipdesai/lootloop/blob/main/docs/compliance/security-audit.md)** — security review notes, complementary to the [security & RLS](../backend/security-rls.md) model.

## App Store (`docs/app-store/`)

- **[Beta testing guide](https://github.com/samipdesai/lootloop/blob/main/docs/app-store/beta-testing-guide.md)** — TestFlight beta process.
- **[Review notes](https://github.com/samipdesai/lootloop/blob/main/docs/app-store/review-notes.md)** — notes for App Store review submission.

## Session notes

- **[`docs/session-notes/`](https://github.com/samipdesai/lootloop/tree/main/docs/session-notes)** — session-by-session progress history.

## Secrets discipline

`SUPABASE_SERVICE_ROLE_KEY` and JWT signing secrets are **never** bundled into client builds. Server/shared values live in root `.env`; the web app exposes only `NEXT_PUBLIC_*` values (safe in the client bundle); mobile loads `apps/mobile/.env` via `react-native-config`. See [local development](../getting-started/local-dev.md).
