import { initial, relativeTime } from './format';

describe('relativeTime', () => {
  const now = new Date('2026-06-21T12:00:00Z');

  test('"just now" under 45s', () => {
    expect(relativeTime('2026-06-21T11:59:30Z', now)).toBe('just now');
  });

  test('minutes', () => {
    expect(relativeTime('2026-06-21T11:55:00Z', now)).toBe('5m ago');
  });

  test('hours', () => {
    expect(relativeTime('2026-06-21T09:00:00Z', now)).toBe('3h ago');
  });

  test('days', () => {
    expect(relativeTime('2026-06-19T12:00:00Z', now)).toBe('2d ago');
  });

  test('falls back to a short date past a week', () => {
    expect(relativeTime('2026-06-01T12:00:00Z', now)).not.toMatch(/ago|just now/);
  });

  test('empty string for an invalid timestamp', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });

  test('clamps future timestamps to "just now"', () => {
    expect(relativeTime('2026-06-21T12:00:30Z', now)).toBe('just now');
  });
});

describe('initial', () => {
  test('first letter, uppercased', () => {
    expect(initial('ava')).toBe('A');
  });

  test('trims leading whitespace', () => {
    expect(initial('  noah')).toBe('N');
  });

  test('degrades to "?" for empty / whitespace', () => {
    expect(initial('   ')).toBe('?');
    expect(initial('')).toBe('?');
  });
});
