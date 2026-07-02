---
title: Chores
description: Parents author recurring chore templates; a daily generator materializes instances that kids claim, complete, and get approved for points.
---

# Chores

## What it does

Chores are the core earning loop. A parent authors chore **templates** — each is either `assigned` (tied to one kid) or `shared` (claimable by any kid) — with a title, lucide icon name, point value, and an optional iCal `RRULE` recurrence string. A scheduled generator materializes each active template into a per-day **instance**. Kids see instances, claim shared ones, and mark them complete; each completion moves through `claimed → pending → approved | rejected`, and approval awards points.

## Data

Three tables (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`chores`** — templates. `assignment` (`chore_assignment` enum: `assigned` | `shared`), `assigned_kid_id` (non-null iff assigned), `points`, `icon`, `recurrence_rule` (RRULE or null for one-off), `active`.
- **`chore_instances`** — one materialized occurrence per `(chore_id, due_date)` (unique constraint makes generation idempotent). Snapshots `points` at generation time.
- **`chore_completions`** — lifecycle rows, one per `(chore_instance_id, kid_id)`. `status` is the `completion_status` enum (`claimed` | `pending` | `approved` | `rejected`), plus `awarded_points`, `reviewed_by`, `claimed_at`, `submitted_at`, `reviewed_at`.

## Backend operations

- **Approve** → `award_points_on_approval(...)` — atomically sets the completion to `approved`, snapshots `awarded_points`, and credits the kid's wallet via the ledger. See [atomic functions](../backend/atomic-functions.md).
- **Reject** → a plain `UPDATE` on `chore_completions` (status `rejected`, `reviewed_by`, `reviewed_at`); no points move.
- **Recurrence generation** → the `generate-recurring-chores` edge function parses each template's RRULE and upserts `chore_instances` for the day. See [edge functions](../backend/edge-functions.md).

## Service layer

`packages/client/src/chores.ts` (parent surface):

- `listChores`, `getChore`, `createChore`, `updateChore`, `deleteChore`
- `listPendingCompletions` — pending queue for the approvals screen
- `approveCompletion(client, completionId, reviewerId, ...)` — wraps the atomic RPC
- `rejectCompletion(client, completionId, reviewerId)`

`packages/client/src/kidChores.ts` (kid surface, runs on the kid session client):

- `listKidChores` — the kid's instances for the day (assigned to them, plus claimable shared ones) with any existing completion status joined in
- `claimChore(kidClient, instanceId, kidId)` — inserts a `claimed` completion for a shared chore
- `completeChore(kidClient, instanceId, kidId)` — updates an existing `claimed` row to `pending`, or inserts a `pending` row directly (the common assigned-chore path)

## UI

- **Parent (web + mobile):** `apps/web/app/(dashboard)/chores/` and `apps/web/app/(dashboard)/approvals/`; `apps/mobile/src/screens/chores/` and `apps/mobile/src/screens/approvals/`.
- **Kid (mobile only):** `apps/mobile/src/screens/kid-chores/`.

## See also

- [Chore approval flow](../flows/chore-approval.md)
