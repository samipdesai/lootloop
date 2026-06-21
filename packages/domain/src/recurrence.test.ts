import { occursOn } from './recurrence';

// Dates are built with the local-time constructor `new Date(y, m, d)` so that
// `getDay()` (which occursOn reads) reflects the intended calendar weekday
// regardless of the runner's timezone.
//
// Reference weekdays (2026):
//   2026-06-15 = Monday, 2026-06-16 = Tuesday, 2026-06-17 = Wednesday,
//   2026-06-18 = Thursday, 2026-06-19 = Friday, 2026-06-20 = Saturday,
//   2026-06-21 = Sunday.
const MON = new Date(2026, 5, 15);
const TUE = new Date(2026, 5, 16);
const WED = new Date(2026, 5, 17);
const THU = new Date(2026, 5, 18);
const FRI = new Date(2026, 5, 19);
const SAT = new Date(2026, 5, 20);
const SUN = new Date(2026, 5, 21);
const WEEK = [MON, TUE, WED, THU, FRI, SAT, SUN];

describe('occursOn', () => {
  describe('null / empty rules (one-off chores)', () => {
    it('returns false for null', () => {
      expect(occursOn(null, MON)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(occursOn('', MON)).toBe(false);
    });

    it('returns false for whitespace-only', () => {
      expect(occursOn('   ', MON)).toBe(false);
    });
  });

  describe('FREQ=DAILY', () => {
    it('matches every day of the week', () => {
      for (const day of WEEK) {
        expect(occursOn('FREQ=DAILY', day)).toBe(true);
      }
    });
  });

  describe('FREQ=WEEKLY;BYDAY', () => {
    it('matches only the listed weekdays', () => {
      const rule = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';
      expect(occursOn(rule, MON)).toBe(true);
      expect(occursOn(rule, TUE)).toBe(false);
      expect(occursOn(rule, WED)).toBe(true);
      expect(occursOn(rule, THU)).toBe(false);
      expect(occursOn(rule, FRI)).toBe(true);
      expect(occursOn(rule, SAT)).toBe(false);
      expect(occursOn(rule, SUN)).toBe(false);
    });

    it('matches weekend days when listed', () => {
      const rule = 'FREQ=WEEKLY;BYDAY=SA,SU';
      expect(occursOn(rule, SAT)).toBe(true);
      expect(occursOn(rule, SUN)).toBe(true);
      expect(occursOn(rule, MON)).toBe(false);
    });

    it('WEEKLY with no BYDAY matches every day', () => {
      for (const day of WEEK) {
        expect(occursOn('FREQ=WEEKLY', day)).toBe(true);
      }
    });
  });

  describe('case-insensitivity', () => {
    it('parses lower-cased DAILY rule', () => {
      expect(occursOn('freq=daily', MON)).toBe(true);
    });

    it('parses mixed-case WEEKLY/BYDAY rule', () => {
      const rule = 'Freq=Weekly;ByDay=mo,we';
      expect(occursOn(rule, MON)).toBe(true);
      expect(occursOn(rule, WED)).toBe(true);
      expect(occursOn(rule, TUE)).toBe(false);
    });

    it('tolerates surrounding whitespace in segments', () => {
      expect(occursOn('FREQ = DAILY', MON)).toBe(true);
    });
  });

  describe('unsupported rules return false', () => {
    it('FREQ=MONTHLY -> false', () => {
      expect(occursOn('FREQ=MONTHLY', MON)).toBe(false);
    });

    it('garbage -> false', () => {
      expect(occursOn('not-a-rule', MON)).toBe(false);
    });
  });
});
