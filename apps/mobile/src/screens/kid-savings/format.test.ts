import { relativeDate } from './format';

const NOW = new Date('2026-06-21T12:00:00Z');

describe('relativeDate', () => {
  it('labels the same day "today"', () => {
    expect(relativeDate('2026-06-21T02:00:00Z', NOW)).toBe('today');
  });

  it('labels a future/clock-skew timestamp "today" (never negative)', () => {
    expect(relativeDate('2026-06-22T00:00:00Z', NOW)).toBe('today');
  });

  it('labels the prior day "yesterday"', () => {
    expect(relativeDate('2026-06-20T08:00:00Z', NOW)).toBe('yesterday');
  });

  it('labels a few days back as "N days ago"', () => {
    expect(relativeDate('2026-06-18T12:00:00Z', NOW)).toBe('3 days ago');
  });

  it('rolls up to weeks and months', () => {
    expect(relativeDate('2026-06-07T12:00:00Z', NOW)).toBe('2 weeks ago');
    expect(relativeDate('2026-04-21T12:00:00Z', NOW)).toBe('2 months ago');
  });
});
