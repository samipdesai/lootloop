---
title: Contributing to the docs
description: How to edit, preview, and deploy the LootLoop wiki, and how to keep it in sync with the code.
---

# Contributing to the docs

This wiki is a [Docusaurus](https://docusaurus.io/) site under [`docs-site/`](https://github.com/samipdesai/lootloop/tree/main/docs-site). Pages are plain Markdown in `docs-site/docs/`. The sidebar order is explicit in `docs-site/sidebars.ts`.

## Run it locally

`docs-site` is its **own** pnpm workspace root — not a member of the repo-root workspace — so Docusaurus never bloats app installs or the [quality gates](./operations/ci-cd.md). Install it from inside the directory:

```bash
cd docs-site
pnpm install
pnpm start           # dev server with hot reload
pnpm build           # production build (run this before pushing)
pnpm serve           # preview the production build
```

## Editing rules

- **Add a page:** create `docs-site/docs/<section>/<name>.md` with frontmatter (`title`, `description`), then add its id to `docs-site/sidebars.ts`.
- **Internal links:** use relative links with the `.md` extension, e.g. `[data model](./backend/data-model.md)`. The build runs with `onBrokenLinks: 'throw'` and `onBrokenAnchors: 'throw'` — a dead link or a link to a non-existent heading **fails the build**. This is the correctness gate: if `pnpm build` passes, the internal links are sound.
- **Diagrams:** use fenced ```mermaid blocks (the Mermaid theme is enabled).
- **Code references:** link source with the GitHub base `https://github.com/samipdesai/lootloop/blob/main/<path>`.

## Deploy

Merging to `main` with changes under `docs-site/**` triggers [`deploy-docs.yml`](https://github.com/samipdesai/lootloop/blob/main/.github/workflows/deploy-docs.yml), which builds and publishes to GitHub Pages at **https://samipdesai.github.io/lootloop/**. No manual deploy step.

## Keeping the wiki honest

This wiki documents the system **as built**. When code and a page disagree, **the code wins** — fix the page in the same PR that changes the behavior. A few source-of-truth boundaries:

- Task breakdown & conventions → [`lootloop-technical-plan.md`](https://github.com/samipdesai/lootloop/blob/main/lootloop-technical-plan.md) and [`CLAUDE.md`](https://github.com/samipdesai/lootloop/blob/main/CLAUDE.md).
- Operational/compliance runbooks → the repo's [`/docs`](https://github.com/samipdesai/lootloop/tree/main/docs) tree (the [operations](./operations/ops.md) page links to them rather than copying).
- Data model, RLS, functions → the SQL in [`supabase/migrations`](https://github.com/samipdesai/lootloop/tree/main/supabase/migrations).
