// Pure helpers shared by the schedule list (display) and form (input parsing).
// No React Native / Supabase imports — unit-tested in schedule.test.ts.
//
// days_of_week is an ISO weekday array (1=Mon..7=Sun); an empty array means the
// item runs every day. start_time / end_time are Postgres `time` strings in
// 'HH:MM:SS' form (the form collects 'HH:MM'); we render them as 'h:mm AM/PM'.

// ISO weekday codes in canonical (Monday-first) order, with short labels for
// the form chips and the list recurrence summary.
export const WEEKDAYS: readonly { iso: number; short: string }[] = [
  { iso: 1, short: 'Mon' },
  { iso: 2, short: 'Tue' },
  { iso: 3, short: 'Wed' },
  { iso: 4, short: 'Thu' },
  { iso: 5, short: 'Fri' },
  { iso: 6, short: 'Sat' },
  { iso: 7, short: 'Sun' },
];

const WEEKDAY_ISO = WEEKDAYS.map((w) => w.iso);

// Sort a set of ISO weekday numbers into canonical (Mon-first) order, de-duped,
// dropping anything outside 1..7.
export function canonicalDays(days: number[]): number[] {
  const set = new Set(days);
  return WEEKDAY_ISO.filter((iso) => set.has(iso));
}

// Format a Postgres time string ('HH:MM' or 'HH:MM:SS') as 'h:mm AM/PM'.
// Returns '' for empty/malformed input so callers can guard.
export function formatTime(time: string | null): string {
  if (!time) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

// Format a start/optional-end pair into a single range label.
export function formatTimeRange(start: string, end: string | null): string {
  const from = formatTime(start);
  const to = formatTime(end);
  return to ? `${from} – ${to}` : from;
}

// Human-readable recurrence summary for a list row.
//   []                 → "Every day"
//   [1,2,3,4,5]        → "Weekdays"
//   [6,7]              → "Weekends"
//   anything else      → "Mon/Wed/Fri"
export function describeDays(days: number[]): string {
  const ordered = canonicalDays(days);
  if (ordered.length === 0) return 'Every day';
  if (ordered.length === 5 && ordered.every((d) => d <= 5)) return 'Weekdays';
  if (ordered.length === 2 && ordered[0] === 6 && ordered[1] === 7) return 'Weekends';
  return ordered.map((iso) => WEEKDAYS.find((w) => w.iso === iso)!.short).join('/');
}

// Validate a 'HH:MM' string entered in the form. Empty is allowed (caller
// decides if the field is required); non-empty must be a real 24h time.
export function parseHHMM(value: string): { ok: true; value: string } | { ok: false } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { ok: false };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { ok: false };
  return { ok: true, value: `${String(hour).padStart(2, '0')}:${match[2]}` };
}

// Auto-format keystrokes from a number-pad into 'HH:MM' so a colon never needs
// typing (the number pad has none). Keeps only digits, caps at 4 (HHMM), and
// inserts the ':' once there are 3+ digits: '' → '', '7' → '7', '07' → '07',
// '073' → '07:3', '0730' → '07:30'. Validation still happens via parseHHMM.
export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// Compare two valid 'HH:MM' strings; true when `end` is strictly after `start`.
export function isAfter(start: string, end: string): boolean {
  return toMinutes(end) > toMinutes(start);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
