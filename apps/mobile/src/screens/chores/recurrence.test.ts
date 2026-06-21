import {
  buildRecurrenceRule,
  parseRecurrenceRule,
  describeRecurrence,
  type RecurrenceState,
} from './recurrence';

describe('buildRecurrenceRule', () => {
  it('returns null for "none"', () => {
    expect(buildRecurrenceRule({ kind: 'none', days: [] })).toBeNull();
  });

  it('returns FREQ=DAILY for "daily"', () => {
    expect(buildRecurrenceRule({ kind: 'daily', days: [] })).toBe('FREQ=DAILY');
  });

  it('serialises weekly days in canonical (Monday-first) order', () => {
    expect(buildRecurrenceRule({ kind: 'weekly', days: ['FR', 'MO', 'WE'] })).toBe(
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    );
  });

  it('de-dupes repeated weekday codes', () => {
    expect(buildRecurrenceRule({ kind: 'weekly', days: ['MO', 'MO', 'TU'] })).toBe(
      'FREQ=WEEKLY;BYDAY=MO,TU',
    );
  });

  it('defensively returns null for weekly with no days', () => {
    expect(buildRecurrenceRule({ kind: 'weekly', days: [] })).toBeNull();
  });
});

describe('parseRecurrenceRule', () => {
  it('maps null to "none"', () => {
    expect(parseRecurrenceRule(null)).toEqual({ kind: 'none', days: [] });
  });

  it('maps FREQ=DAILY to "daily"', () => {
    expect(parseRecurrenceRule('FREQ=DAILY')).toEqual({ kind: 'daily', days: [] });
  });

  it('parses weekly BYDAY into canonical order', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toEqual({
      kind: 'weekly',
      days: ['MO', 'WE', 'FR'],
    });
  });

  it('re-canonicalises out-of-order BYDAY codes', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=FR,MO')).toEqual({
      kind: 'weekly',
      days: ['MO', 'FR'],
    });
  });

  it('falls back to "none" on unrecognised rules', () => {
    expect(parseRecurrenceRule('FREQ=MONTHLY')).toEqual({ kind: 'none', days: [] });
    expect(parseRecurrenceRule('garbage')).toEqual({ kind: 'none', days: [] });
  });

  it('ignores invalid weekday codes inside BYDAY', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=XX')).toEqual({ kind: 'none', days: [] });
  });
});

describe('build/parse round-trips', () => {
  const cases: RecurrenceState[] = [
    { kind: 'none', days: [] },
    { kind: 'daily', days: [] },
    { kind: 'weekly', days: ['MO', 'WE', 'FR'] },
    { kind: 'weekly', days: ['SA', 'SU'] },
    { kind: 'weekly', days: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] },
  ];

  it.each(cases)('round-trips %j', (state) => {
    expect(parseRecurrenceRule(buildRecurrenceRule(state))).toEqual(state);
  });
});

describe('describeRecurrence', () => {
  it('labels none as One-off', () => {
    expect(describeRecurrence(null)).toBe('One-off');
  });

  it('labels daily as Daily', () => {
    expect(describeRecurrence('FREQ=DAILY')).toBe('Daily');
  });

  it('labels weekly as slash-joined short days', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Mon/Wed/Fri');
  });
});
