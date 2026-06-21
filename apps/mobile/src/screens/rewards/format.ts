// Pure formatting helpers for the Rewards fulfillment queue (#25). Kept free of
// React / Supabase so they can be unit-tested directly (see format.test.ts).

// Compact relative-time label for a purchased_at ISO timestamp, e.g. "just now",
// "5m ago", "3h ago", "2d ago". Falls back to a short date past a week. `now` is
// injectable for deterministic tests.
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// First letter of a display name for the avatar fallback. Trims, uppercases,
// and degrades to '?' for empty/whitespace names.
export function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}
