// Pure presentation helpers for the kid Savings screen. Kept separate so they
// can be unit-tested without pulling in React Native / Supabase.

// A short, kid-friendly relative date ("today", "yesterday", "3 days ago",
// "2 weeks ago"). `now` is injectable so the test is deterministic.
export function relativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'last month';
  return `${Math.floor(days / 30)} months ago`;
}
