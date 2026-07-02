---
title: Reading
description: Kids log reading sessions; parent approval awards points and advances a reading streak atomically.
---

# Reading

## What it does

Reading is a second earning loop that rewards a daily habit. A kid logs a reading session (book title, minutes, the date read), which starts as `pending`. A parent reviews it; approving both awards points and advances the kid's reading streak in a single atomic operation.

## Data

Two tables (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`reading_logs`** — one row per session. `book_title`, `minutes`, `read_on` (date), `status` (the `reading_status` enum: `pending` | `approved` | `rejected`), `awarded_points`.
- **`reading_streaks`** — per-kid `current_streak` and `longest_streak`.

## Backend operations

- **Approve** → `approve_reading_log(...)` — atomically sets the log to `approved`, credits the wallet via an `earn` ledger entry, and advances/updates the streak. See [atomic functions](../backend/atomic-functions.md).
- **Reject** → a plain `UPDATE` on `reading_logs` (status `rejected`); no points and no streak change.

## Service layer

`packages/client/src/reading.ts`:

- `createReadingLog(client, input)` — kid logs a session
- `listKidReadingLogs(client, kidId)`
- `getReadingStreak(client, kidId)`
- `listPendingReadingLogs` — parent approval queue
- `approveReadingLog(...)` — wraps the atomic RPC
- `rejectReadingLog(client, readingId, reviewerId)`

## UI

- **Parent (web + mobile):** reading approvals surface in the approvals queue (`apps/web/app/(dashboard)/approvals/`, `apps/mobile/src/screens/approvals/`).
- **Kid (mobile only):** `apps/mobile/src/screens/kid-reading/`.

## See also

- [Reading streak flow](../flows/reading-streak.md)
