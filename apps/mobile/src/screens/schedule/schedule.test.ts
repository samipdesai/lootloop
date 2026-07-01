import {
  canonicalDays,
  formatTime,
  formatTimeRange,
  describeDays,
  parseHHMM,
  isAfter,
  maskTime,
} from './schedule';

describe('maskTime', () => {
  it('inserts the colon after the second digit', () => {
    expect(maskTime('0730')).toBe('07:30');
  });

  it('leaves one or two digits uncolonized', () => {
    expect(maskTime('7')).toBe('7');
    expect(maskTime('07')).toBe('07');
  });

  it('shows a partial minute after three digits', () => {
    expect(maskTime('073')).toBe('07:3');
  });

  it('strips non-digits (including an already-typed colon)', () => {
    expect(maskTime('07:30')).toBe('07:30');
    expect(maskTime('a7b3')).toBe('73');
  });

  it('caps at four digits (HHMM)', () => {
    expect(maskTime('073099')).toBe('07:30');
  });

  it('returns empty for empty', () => {
    expect(maskTime('')).toBe('');
  });
});

describe('canonicalDays', () => {
  it('orders Monday-first and de-dupes', () => {
    expect(canonicalDays([5, 1, 1, 3])).toEqual([1, 3, 5]);
  });

  it('drops out-of-range codes', () => {
    expect(canonicalDays([0, 1, 8, 7])).toEqual([1, 7]);
  });

  it('returns [] for empty', () => {
    expect(canonicalDays([])).toEqual([]);
  });
});

describe('formatTime', () => {
  it('formats midnight as 12:00 AM', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });

  it('formats morning HH:MM:SS', () => {
    expect(formatTime('07:05:00')).toBe('7:05 AM');
  });

  it('formats afternoon', () => {
    expect(formatTime('15:30:00')).toBe('3:30 PM');
  });

  it('accepts HH:MM without seconds', () => {
    expect(formatTime('09:15')).toBe('9:15 AM');
  });

  it('returns empty for null / malformed', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('nope')).toBe('');
    expect(formatTime('25:00')).toBe('');
    expect(formatTime('10:99')).toBe('');
  });
});

describe('formatTimeRange', () => {
  it('renders start only when no end', () => {
    expect(formatTimeRange('08:00:00', null)).toBe('8:00 AM');
  });

  it('renders a range when end is set', () => {
    expect(formatTimeRange('08:00:00', '08:30:00')).toBe('8:00 AM – 8:30 AM');
  });
});

describe('describeDays', () => {
  it('labels empty as Every day', () => {
    expect(describeDays([])).toBe('Every day');
  });

  it('labels Mon–Fri as Weekdays', () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([5, 4, 3, 2, 1])).toBe('Weekdays');
  });

  it('labels Sat+Sun as Weekends', () => {
    expect(describeDays([6, 7])).toBe('Weekends');
  });

  it('labels an arbitrary set as slash-joined shorts', () => {
    expect(describeDays([1, 3, 5])).toBe('Mon/Wed/Fri');
  });

  it('does not treat a partial weekday set as Weekdays', () => {
    expect(describeDays([1, 2, 3])).toBe('Mon/Tue/Wed');
  });
});

describe('parseHHMM', () => {
  it('accepts and zero-pads a valid time', () => {
    expect(parseHHMM('9:05')).toEqual({ ok: true, value: '09:05' });
    expect(parseHHMM('23:59')).toEqual({ ok: true, value: '23:59' });
  });

  it('rejects malformed / out-of-range', () => {
    expect(parseHHMM('')).toEqual({ ok: false });
    expect(parseHHMM('24:00')).toEqual({ ok: false });
    expect(parseHHMM('10:60')).toEqual({ ok: false });
    expect(parseHHMM('abc')).toEqual({ ok: false });
    expect(parseHHMM('7')).toEqual({ ok: false });
  });
});

describe('isAfter', () => {
  it('is true when end is strictly later', () => {
    expect(isAfter('08:00', '08:30')).toBe(true);
  });

  it('is false when equal or earlier', () => {
    expect(isAfter('08:00', '08:00')).toBe(false);
    expect(isAfter('09:00', '08:00')).toBe(false);
  });
});
