import { initial, relativeTime } from './format';

describe('relativeTime', () => {
  const now = new Date('2026-06-21T12:00:00.000Z');

  it('returns "just now" for very recent timestamps', () => {
    expect(relativeTime('2026-06-21T11:59:30.000Z', now)).toBe('just now');
  });

  it('formats minutes', () => {
    expect(relativeTime('2026-06-21T11:55:00.000Z', now)).toBe('5m ago');
  });

  it('formats hours', () => {
    expect(relativeTime('2026-06-21T09:00:00.000Z', now)).toBe('3h ago');
  });

  it('formats days', () => {
    expect(relativeTime('2026-06-19T12:00:00.000Z', now)).toBe('2d ago');
  });

  it('returns empty string for an invalid date', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});

describe('initial', () => {
  it('uppercases the first letter', () => {
    expect(initial('ava')).toBe('A');
  });

  it('trims surrounding whitespace', () => {
    expect(initial('  liam')).toBe('L');
  });

  it('falls back to "?" for an empty name', () => {
    expect(initial('   ')).toBe('?');
  });
});
