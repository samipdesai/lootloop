// Recurrence mapping shared by the chore form (build) and list (display).
// The chore-instance generator (task #14) understands exactly these rule strings:
//   null                          → does not repeat
//   "FREQ=DAILY"                  → every day
//   "FREQ=WEEKLY;BYDAY=MO,WE,FR"  → weekly on the listed weekdays
// Weekday codes are emitted in canonical week order (Monday-first).

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

// Canonical week order used when serialising BYDAY.
export const WEEKDAYS: readonly { code: Weekday; short: string; long: string }[] = [
  { code: 'MO', short: 'Mon', long: 'Monday' },
  { code: 'TU', short: 'Tue', long: 'Tuesday' },
  { code: 'WE', short: 'Wed', long: 'Wednesday' },
  { code: 'TH', short: 'Thu', long: 'Thursday' },
  { code: 'FR', short: 'Fri', long: 'Friday' },
  { code: 'SA', short: 'Sat', long: 'Saturday' },
  { code: 'SU', short: 'Sun', long: 'Sunday' },
];

export type RecurrenceKind = 'none' | 'daily' | 'weekly';

export interface RecurrenceState {
  kind: RecurrenceKind;
  // Only meaningful when kind === 'weekly'.
  days: Weekday[];
}

const WEEKDAY_CODES = WEEKDAYS.map(w => w.code);

// Sort a set of weekday codes into canonical (Monday-first) order, de-duped.
function canonicalOrder(days: Weekday[]): Weekday[] {
  const set = new Set(days);
  return WEEKDAY_CODES.filter(code => set.has(code));
}

// Build the recurrence_rule column value from UI state. Returns null for "none".
// Weekly with zero days is invalid input — callers must validate first — but we
// defensively return null rather than emit a malformed BYDAY= rule.
export function buildRecurrenceRule(state: RecurrenceState): string | null {
  if (state.kind === 'daily') return 'FREQ=DAILY';
  if (state.kind === 'weekly') {
    const days = canonicalOrder(state.days);
    if (days.length === 0) return null;
    return `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
  }
  return null;
}

// Parse a stored recurrence_rule back into UI state (for editing). Unrecognised
// rules fall back to 'none' so the form never crashes on legacy data.
export function parseRecurrenceRule(rule: string | null): RecurrenceState {
  if (!rule) return { kind: 'none', days: [] };
  if (rule === 'FREQ=DAILY') return { kind: 'daily', days: [] };

  const match = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(rule);
  if (match) {
    const codes = match[1]
      .split(',')
      .filter((c): c is Weekday => (WEEKDAY_CODES as string[]).includes(c));
    const days = canonicalOrder(codes);
    if (days.length > 0) return { kind: 'weekly', days };
  }
  return { kind: 'none', days: [] };
}

// Human-readable label for a stored rule, used in list rows.
export function describeRecurrence(rule: string | null): string {
  const state = parseRecurrenceRule(rule);
  if (state.kind === 'daily') return 'Daily';
  if (state.kind === 'weekly') {
    const shorts = state.days.map(code => WEEKDAYS.find(w => w.code === code)!.short);
    return shorts.join('/');
  }
  return 'One-off';
}
