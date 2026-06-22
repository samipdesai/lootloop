import { formatTime, isoWeekday, todaysItems } from './timeline';
import type { ScheduleItem } from '@lootloop/client';

function item(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'x',
    title: 'Item',
    icon: null,
    start_time: '08:00:00',
    end_time: null,
    days_of_week: [],
    active: true,
    ...over,
  } as ScheduleItem;
}

describe('isoWeekday', () => {
  it('maps Sunday (JS 0) to ISO 7', () => {
    expect(isoWeekday(new Date('2026-06-21T12:00:00'))).toBe(7); // Sunday
  });
  it('maps Monday to ISO 1', () => {
    expect(isoWeekday(new Date('2026-06-22T12:00:00'))).toBe(1); // Monday
  });
});

describe('todaysItems', () => {
  const monday = new Date('2026-06-22T09:00:00'); // ISO weekday 1

  it('includes items with empty days_of_week (every day)', () => {
    const out = todaysItems([item({ id: 'a', days_of_week: [] })], monday);
    expect(out.map((i) => i.id)).toEqual(['a']);
  });

  it('includes items whose days_of_week contains today and excludes others', () => {
    const out = todaysItems(
      [
        item({ id: 'mon', days_of_week: [1] }),
        item({ id: 'tue', days_of_week: [2] }),
        item({ id: 'weekdays', days_of_week: [1, 2, 3, 4, 5] }),
      ],
      monday,
    );
    expect(out.map((i) => i.id)).toEqual(['mon', 'weekdays']);
  });

  it('orders by start_time ascending', () => {
    const out = todaysItems(
      [
        item({ id: 'late', start_time: '17:00:00' }),
        item({ id: 'early', start_time: '06:30:00' }),
        item({ id: 'mid', start_time: '12:00:00' }),
      ],
      monday,
    );
    expect(out.map((i) => i.id)).toEqual(['early', 'mid', 'late']);
  });
});

describe('formatTime', () => {
  it('formats morning HH:MM:SS to h:mm AM', () => {
    expect(formatTime('07:30:00')).toBe('7:30 AM');
  });
  it('formats afternoon HH:MM:SS to h:mm PM', () => {
    expect(formatTime('13:05:00')).toBe('1:05 PM');
  });
  it('formats midnight as 12:mm AM and noon as 12:mm PM', () => {
    expect(formatTime('00:15:00')).toBe('12:15 AM');
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });
  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });
});
