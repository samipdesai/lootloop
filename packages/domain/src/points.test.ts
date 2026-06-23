import { addPoints, deductPoints } from './points';

describe('addPoints', () => {
  it('adds points to a balance', () => {
    expect(addPoints(100, 25)).toBe(125);
  });

  it('is a no-op when adding zero', () => {
    expect(addPoints(100, 0)).toBe(100);
  });

  it('adds to a zero balance', () => {
    expect(addPoints(0, 50)).toBe(50);
  });

  it('throws on a negative amount', () => {
    expect(() => addPoints(100, -1)).toThrow('amount must be non-negative');
  });
});

describe('deductPoints', () => {
  it('deducts points from a balance', () => {
    expect(deductPoints(100, 25)).toBe(75);
  });

  it('allows an exact-boundary deduction down to zero', () => {
    expect(deductPoints(50, 50)).toBe(0);
  });

  it('is a no-op when deducting zero', () => {
    expect(deductPoints(100, 0)).toBe(100);
  });

  it('throws on a negative amount', () => {
    expect(() => deductPoints(100, -1)).toThrow('amount must be non-negative');
  });

  it('throws on insufficient balance', () => {
    expect(() => deductPoints(10, 11)).toThrow('insufficient balance');
  });

  it('throws on insufficient balance from zero', () => {
    expect(() => deductPoints(0, 1)).toThrow('insufficient balance');
  });

  it('checks the negative-amount guard before the balance guard', () => {
    // amount < 0 is rejected even when balance is also insufficient.
    expect(() => deductPoints(0, -5)).toThrow('amount must be non-negative');
  });
});
