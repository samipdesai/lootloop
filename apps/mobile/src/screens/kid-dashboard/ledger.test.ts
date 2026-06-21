import { ledgerRow, relativeDate } from './ledger';

describe('ledgerRow', () => {
  it('labels each transaction type', () => {
    expect(ledgerRow({ type: 'earn', amount: 25 }).label).toBe('Earned');
    expect(ledgerRow({ type: 'bonus', amount: 5 }).label).toBe('Bonus');
    expect(ledgerRow({ type: 'spend', amount: -10 }).label).toBe('Spent');
    expect(ledgerRow({ type: 'refund', amount: 10 }).label).toBe('Refund');
  });

  it('marks credits positive with a + prefix', () => {
    const row = ledgerRow({ type: 'earn', amount: 1250 });
    expect(row.tone).toBe('positive');
    expect(row.amountText).toBe('+1,250');
  });

  it('marks debits negative with a − prefix and magnitude', () => {
    const row = ledgerRow({ type: 'spend', amount: -40 });
    expect(row.tone).toBe('negative');
    expect(row.amountText).toBe('−40');
  });
});

describe('relativeDate', () => {
  const now = new Date('2026-06-21T12:00:00');

  it('returns Today for the same calendar day', () => {
    expect(relativeDate('2026-06-21T06:00:00', now)).toBe('Today');
  });

  it('returns Yesterday for the previous day', () => {
    expect(relativeDate('2026-06-20T23:00:00', now)).toBe('Yesterday');
  });

  it('returns a short month/day for older dates', () => {
    expect(relativeDate('2026-06-03T10:00:00', now)).toBe('Jun 3');
  });
});
