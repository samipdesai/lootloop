import { canAfford, shortfall } from './affordability';

describe('canAfford', () => {
  test('true when balance covers cost', () => {
    expect(canAfford(100, 50)).toBe(true);
  });

  test('true when balance exactly equals cost', () => {
    expect(canAfford(50, 50)).toBe(true);
  });

  test('false when balance is short', () => {
    expect(canAfford(49, 50)).toBe(false);
  });

  test('free reward (cost 0) is always affordable', () => {
    expect(canAfford(0, 0)).toBe(true);
  });

  test('false while balance is unknown (null)', () => {
    expect(canAfford(null, 50)).toBe(false);
  });
});

describe('shortfall', () => {
  test('0 when affordable', () => {
    expect(shortfall(100, 50)).toBe(0);
  });

  test('the missing amount when short', () => {
    expect(shortfall(30, 50)).toBe(20);
  });

  test('the full cost while balance is unknown (null)', () => {
    expect(shortfall(null, 50)).toBe(50);
  });
});
