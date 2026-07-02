---
title: Schedule
description: Parents author a per-kid daily timeline of time-based items; kids see it read-only.
---

# Schedule

## What it does

The schedule is a per-kid daily timeline — a list of time-based items (e.g. "Homework", "Dinner") a parent authors to structure a kid's day. Items recur on selected days of the week. Kids view the timeline read-only; only parents create and edit items.

## Data

One table (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`schedule_items`** — `title`, `icon`, `start_time`, `end_time` (nullable; must be after `start_time` when set), `days_of_week` (`smallint[]`, ISO weekday numbers 1=Mon .. 7=Sun; empty array means every day), `active`, scoped by `family_id` and `kid_id`.

## Backend operations

No atomic functions or RPCs — schedule items are plain family-scoped table CRUD guarded by RLS (see [security & RLS](../backend/security-rls.md)).

## Service layer

`packages/client/src/schedule.ts`:

- `listScheduleItems(client)` — all items for the family
- `listKidScheduleItems(client, kidId)` — one kid's timeline
- `createScheduleItem(client, input)`
- `updateScheduleItem(client, id, patch)`
- `deleteScheduleItem(client, id)`

## UI

- **Parent (web + mobile):** `apps/web/app/(dashboard)/schedule/`; `apps/mobile/src/screens/schedule/`.
- **Kid (mobile only):** the timeline surfaces read-only in the kid dashboard (`apps/mobile/src/screens/kid-dashboard/`).
