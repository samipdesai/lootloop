// Day-of-week + time helpers shared by the schedule form (build) and list
// (display). days_of_week is an ISO weekday array (1=Mon..7=Sun); an empty
// array means "every day" (the kid timeline treats `[]` as unconditional).

export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Canonical Monday-first week order used for chips and serialisation.
export const WEEKDAYS: readonly { code: IsoDay; short: string; long: string }[] = [
  { code: 1, short: 'Mon', long: 'Monday' },
  { code: 2, short: 'Tue', long: 'Tuesday' },
  { code: 3, short: 'Wed', long: 'Wednesday' },
  { code: 4, short: 'Thu', long: 'Thursday' },
  { code: 5, short: 'Fri', long: 'Friday' },
  { code: 6, short: 'Sat', long: 'Saturday' },
  { code: 7, short: 'Sun', long: 'Sunday' },
];

const WEEKDAY_CODES = WEEKDAYS.map(w => w.code);
const WEEKDAYS_SET = '1,2,3,4,5';
const WEEKEND_SET = '6,7';

// Sort a set of ISO weekday codes into canonical (Monday-first) order, de-duped.
export function canonicalDays(days: number[]): IsoDay[] {
  const set = new Set(days);
  return WEEKDAY_CODES.filter(code => set.has(code));
}

// Human-readable label for a stored days_of_week array, used in list rows.
//   []                 → "Every day"
//   [1,2,3,4,5]        → "Weekdays"
//   [6,7]              → "Weekends"
//   [1,3,5]            → "Mon / Wed / Fri"
export function describeDays(days: number[]): string {
  const ordered = canonicalDays(days);
  if (ordered.length === 0 || ordered.length === 7) return 'Every day';
  const key = ordered.join(',');
  if (key === WEEKDAYS_SET) return 'Weekdays';
  if (key === WEEKEND_SET) return 'Weekends';
  return ordered.map(code => WEEKDAYS.find(w => w.code === code)!.short).join(' / ');
}

// Format a Postgres time string ('HH:MM:SS' or 'HH:MM') as 'h:mm AM/PM'.
// Returns the raw input unchanged if it doesn't parse, so the row never breaks.
export function formatTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

// Convert an 'HH:MM:SS' / 'HH:MM' time to the 'HH:MM' value an <input type="time">
// expects when prefilling the edit form.
export function toTimeInputValue(time: string | null): string {
  if (!time) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

// True when `end` (HH:MM) is strictly after `start` (HH:MM). Mirrors the DB CHECK.
export function isEndAfterStart(start: string, end: string): boolean {
  return end > start;
}
