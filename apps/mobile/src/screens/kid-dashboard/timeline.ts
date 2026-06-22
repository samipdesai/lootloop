// Pure presentation helpers for the kid's "Today's schedule" timeline (#37).
// Kept separate from the screen so they're trivially unit-testable (no Supabase,
// no React). Two jobs: pick the schedule items that apply *today* (and order
// them), and turn an 'HH:MM:SS' wall-clock string into a friendly 'h:mm AM/PM'.
import type { ScheduleItem } from '@lootloop/client';

// JS Date.getDay(): Sun=0..Sat=6. ISO weekday: Mon=1..Sun=7. days_of_week uses
// the ISO convention; '[]' means "every day".
export function isoWeekday(date: Date = new Date()): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

// An item is on today if it has no day restriction (every day) or its
// days_of_week includes today's ISO weekday.
export function isToday(item: Pick<ScheduleItem, 'days_of_week'>, today: number): boolean {
  const days = item.days_of_week ?? [];
  return days.length === 0 || days.includes(today);
}

// Today's items, earliest first. Input is assumed to already be the kid's active
// items; we filter to today's weekday and (re)sort by start_time so the timeline
// reads top-to-bottom in time order regardless of input order.
export function todaysItems(items: ScheduleItem[], now: Date = new Date()): ScheduleItem[] {
  const today = isoWeekday(now);
  return items
    .filter((i) => isToday(i, today))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// 'HH:MM:SS' (or 'HH:MM') → 'h:mm AM/PM' (e.g. '07:30:00' → '7:30 AM',
// '13:05:00' → '1:05 PM'). Returns the raw input if it doesn't parse.
export function formatTime(hms: string | null): string {
  if (!hms) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hms);
  if (!m) return hms;
  const h24 = Number(m[1]);
  const minutes = m[2];
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutes} ${period}`;
}
