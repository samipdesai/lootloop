// Pure presentation + validation helpers for the kid Reading screen (#27/#30).
// Kept separate from index.tsx so they're trivially unit-testable (no Supabase,
// no React). Covers: the celebratory streak label, the minutes label, a
// status-badge descriptor for a reading log, and the "log reading" form
// validation. Mirrors kid-dashboard/ledger.ts.
import type { ReadingLog, ReadingStreak } from '@lootloop/client';

// "🔥 5 day streak" / "Start a streak today!" when 0. The flame is part of the
// celebration — a kid sees momentum at a glance.
export function streakLabel(currentStreak: number): string {
  if (currentStreak <= 0) return 'Start a streak today!';
  return `🔥 ${currentStreak} day streak`;
}

// Pull the current/longest off a (possibly null) streak row, clamped at 0 so the
// header never shows a negative or undefined count.
export function streakCounts(streak: ReadingStreak | null): {
  current: number;
  longest: number;
} {
  return {
    current: Math.max(0, streak?.current_streak ?? 0),
    longest: Math.max(0, streak?.longest_streak ?? 0),
  };
}

// "1 min" / "30 mins" — singular/plural, a friendly compact label for a log row.
export function minutesLabel(minutes: number): string {
  return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
}

export type BadgeTone = 'coin' | 'mint' | 'danger';

export interface StatusBadge {
  label: string; // "Pending" / "+15" / "Try again"
  tone: BadgeTone; // coin=pending, mint=approved (with points), danger=rejected
}

// Maps a log's status into its badge. Approved shows the awarded points (mint);
// pending is coin; rejected is danger ("Try again", kid-friendly).
export function statusBadge(
  log: Pick<ReadingLog, 'status' | 'awarded_points'>,
): StatusBadge {
  if (log.status === 'approved') {
    return { label: `+${log.awarded_points ?? 0}`, tone: 'mint' };
  }
  if (log.status === 'rejected') {
    return { label: 'Try again', tone: 'danger' };
  }
  return { label: 'Pending', tone: 'coin' };
}

// "Today" / "Yesterday" / "Mar 3" — friendly relative date for the read_on day.
// read_on is a YYYY-MM-DD calendar date; parse it as local so it lands on the
// right day regardless of timezone. `now` is injectable for deterministic tests.
export function readOnLabel(readOn: string, now: Date = new Date()): string {
  const [y, m, d] = readOn.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const startOf = (dt: Date) =>
    new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now) - startOf(then)) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const MAX_TITLE_LEN = 200;

export interface LogFormErrors {
  bookTitle?: string;
  minutes?: string;
}

// Validates the "log reading" form. Returns the cleaned values plus any field
// errors. book_title: required, trimmed, 1–200 chars. minutes: required, an
// integer > 0. Pure so the screen can show inline errors without a round-trip.
export function validateLogForm(input: { bookTitle: string; minutes: string }): {
  errors: LogFormErrors;
  valid: boolean;
  values: { bookTitle: string; minutes: number };
} {
  const errors: LogFormErrors = {};
  const bookTitle = input.bookTitle.trim();
  if (bookTitle.length === 0) {
    errors.bookTitle = 'Add the book title.';
  } else if (bookTitle.length > MAX_TITLE_LEN) {
    errors.bookTitle = `Keep it under ${MAX_TITLE_LEN} characters.`;
  }

  const raw = input.minutes.trim();
  const minutes = Number(raw);
  if (raw.length === 0) {
    errors.minutes = 'How many minutes did you read?';
  } else if (!Number.isInteger(minutes) || minutes <= 0) {
    errors.minutes = 'Enter whole minutes (more than 0).';
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
    values: { bookTitle, minutes },
  };
}
