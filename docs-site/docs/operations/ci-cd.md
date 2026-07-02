---
title: CI/CD
description: The GitHub Actions workflows, quality gates, and deploy pipelines — including this wiki's own deploy.
---

# CI/CD

All pipelines are GitHub Actions in [`.github/workflows/`](https://github.com/samipdesai/lootloop/tree/main/.github/workflows). Git is trunk-based: short-lived `feature/*` branches → PR → squash-merge to `main`. See [stack decisions](../architecture/stack-decisions.md).

## Quality gates (branch protection)

Every PR to `main` runs [`pr-checks.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/pr-checks.yml) — the fast regression gate. Its four jobs map to the required status checks:

| Job                  | What it runs                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint-and-typecheck` | `pnpm -r lint` + `pnpm -r typecheck` (Node 22)                                                                                                            |
| `test`               | Spins up local Supabase (Docker), then `pnpm -r test --coverage --ci` (enforces the 70% thresholds) + `pnpm test:integration` (SQL RLS + atomic-fn suite) |
| `build-web`          | `pnpm --filter web build` with `NEXT_PUBLIC_*` placeholders                                                                                               |
| `mobile-typecheck`   | `pnpm --filter mobile typecheck`                                                                                                                          |

Browser/device E2E is intentionally **off** the per-PR path for speed.

## Web production deploy

[`deploy-web.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/deploy-web.yml) runs on push to `main`. It mirrors the full PR regression **plus** a `web-e2e` job (Playwright parent golden paths against a local Supabase), then a `deploy` job that promotes to **Vercel production** — but only if every prior job is green (`needs:` on all of them). The deploy is gated behind the `VERCEL_DEPLOY_ENABLED` repo variable, so before Vercel is wired the regression still runs and the deploy step simply skips.

## Mobile release → TestFlight

[`release.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/release.yml) fires on a `v*` tag (or manual dispatch). It runs the full `{kid,parent}×{iPhone,iPad}` **Maestro** matrix on a macOS runner, then — only if it passes — builds the signed Release `.ipa` and uploads to **TestFlight** via Fastlane (`fastlane beta`: match → gym → pilot). Gated behind `IOS_TESTFLIGHT_ENABLED`. Status: the Fastlane `beta` lane is verified end-to-end locally; the Maestro simulator build on a GitHub macOS runner has not yet had a green CI run (see [roadmap](./roadmap.md)).

## Database backup + keep-alive

[`db-backup.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/db-backup.yml) runs daily. It pings the project's auth health endpoint (keep-alive, so free-tier Supabase never pauses) and — once `SUPABASE_DB_URL` is set — `pg_dump`s prod and stores a **gpg-encrypted** dump as a private 90-day artifact. See [backup & restore runbook](./ops.md).

## Docs wiki deploy

This wiki deploys via [`deploy-docs.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/deploy-docs.yml): on push to `main` that touches `docs-site/**`, it builds the Docusaurus site and publishes to **GitHub Pages** at `https://samipdesai.github.io/lootloop/`. Because `docs-site` is its **own** pnpm workspace root (not a member of the repo-root workspace), it never appears in the app quality gates above and never slows PR installs. See [contributing](../contributing.md).

> One-time setup: GitHub → repo **Settings → Pages → Source = GitHub Actions**.

## Environments

| Env        | Supabase                  | Web            | Mobile           |
| ---------- | ------------------------- | -------------- | ---------------- |
| Local      | Docker (`supabase start`) | localhost:3000 | iOS sim / device |
| Production | Supabase cloud            | Vercel         | TestFlight       |

Secrets discipline: `SUPABASE_SERVICE_ROLE_KEY` and JWT signing secrets never enter client builds; CI supplies public placeholders for the web build. See [local development](../getting-started/local-dev.md).
