import {
  streakLabel,
  streakCounts,
  minutesLabel,
  statusBadge,
  readOnLabel,
  validateLogForm,
  MAX_TITLE_LEN,
} from './reading';

describe('streakLabel', () => {
  it('is celebratory with a flame when active', () => {
    expect(streakLabel(5)).toBe('🔥 5 day streak');
    expect(streakLabel(1)).toBe('🔥 1 day streak');
  });
  it('prompts to start when zero or negative', () => {
    expect(streakLabel(0)).toBe('Start a streak today!');
    expect(streakLabel(-3)).toBe('Start a streak today!');
  });
});

describe('streakCounts', () => {
  it('clamps a null streak to zero', () => {
    expect(streakCounts(null)).toEqual({ current: 0, longest: 0 });
  });
  it('reads current/longest off the row', () => {
    const row = {
      current_streak: 4,
      longest_streak: 9,
      last_read_date: '2026-06-21',
    } as Parameters<typeof streakCounts>[0];
    expect(streakCounts(row)).toEqual({ current: 4, longest: 9 });
  });
});

describe('minutesLabel', () => {
  it('singularizes 1 minute', () => {
    expect(minutesLabel(1)).toBe('1 min');
  });
  it('pluralizes others', () => {
    expect(minutesLabel(30)).toBe('30 mins');
    expect(minutesLabel(0)).toBe('0 mins');
  });
});

describe('statusBadge', () => {
  it('shows awarded points (coin->mint) when approved', () => {
    expect(statusBadge({ status: 'approved', awarded_points: 15 })).toEqual({
      label: '+15',
      tone: 'mint',
    });
    expect(statusBadge({ status: 'approved', awarded_points: null })).toEqual({
      label: '+0',
      tone: 'mint',
    });
  });
  it('is coin/Pending when pending', () => {
    expect(statusBadge({ status: 'pending', awarded_points: null })).toEqual({
      label: 'Pending',
      tone: 'coin',
    });
  });
  it('is danger/Try again when rejected', () => {
    expect(statusBadge({ status: 'rejected', awarded_points: null })).toEqual({
      label: 'Try again',
      tone: 'danger',
    });
  });
});

describe('readOnLabel', () => {
  const now = new Date(2026, 5, 21); // Jun 21 2026, local
  it('labels today and yesterday', () => {
    expect(readOnLabel('2026-06-21', now)).toBe('Today');
    expect(readOnLabel('2026-06-20', now)).toBe('Yesterday');
  });
  it('formats older dates as Mon Day', () => {
    expect(readOnLabel('2026-06-15', now)).toBe('Jun 15');
  });
});

describe('validateLogForm', () => {
  it('accepts a valid entry and trims the title', () => {
    const r = validateLogForm({ bookTitle: '  Dog Man  ', minutes: '20' });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ bookTitle: 'Dog Man', minutes: 20 });
  });
  it('requires a book title', () => {
    const r = validateLogForm({ bookTitle: '   ', minutes: '10' });
    expect(r.valid).toBe(false);
    expect(r.errors.bookTitle).toBeTruthy();
  });
  it('rejects an over-long title', () => {
    const r = validateLogForm({ bookTitle: 'x'.repeat(MAX_TITLE_LEN + 1), minutes: '10' });
    expect(r.errors.bookTitle).toBeTruthy();
  });
  it('requires positive integer minutes', () => {
    expect(validateLogForm({ bookTitle: 'A', minutes: '' }).errors.minutes).toBeTruthy();
    expect(validateLogForm({ bookTitle: 'A', minutes: '0' }).errors.minutes).toBeTruthy();
    expect(validateLogForm({ bookTitle: 'A', minutes: '-5' }).errors.minutes).toBeTruthy();
    expect(validateLogForm({ bookTitle: 'A', minutes: '12.5' }).errors.minutes).toBeTruthy();
    expect(validateLogForm({ bookTitle: 'A', minutes: 'abc' }).errors.minutes).toBeTruthy();
  });
});
