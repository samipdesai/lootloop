import { MONTHLY_RATE, calculateInterest, projectInterest } from './interest';

describe('MONTHLY_RATE', () => {
  it('is the 5% teaching rate', () => {
    expect(MONTHLY_RATE).toBe(0.05);
  });
});

describe('calculateInterest', () => {
  describe('boundary balances', () => {
    it('returns 0 for a zero balance', () => {
      expect(calculateInterest(0)).toBe(0);
    });

    it('rounds a tiny balance (9 * 0.05 = 0.45) down to 0', () => {
      expect(calculateInterest(9)).toBe(0);
    });

    it('rounds a tiny balance (10 * 0.05 = 0.5) up to 1', () => {
      expect(calculateInterest(10)).toBe(1);
    });

    it('handles a large balance', () => {
      // 1_000_000 * 0.05 = 50_000 exactly.
      expect(calculateInterest(1_000_000)).toBe(50_000);
    });
  });

  describe('rounding (Math.round, half rounds up)', () => {
    it('rounds .5 up: 30 * 0.05 = 1.5 -> 2', () => {
      expect(calculateInterest(30)).toBe(2);
    });

    it('rounds below .5 down: 25 * 0.05 = 1.25 -> 1', () => {
      expect(calculateInterest(25)).toBe(1);
    });

    it('rounds above .5 up: 27 * 0.05 = 1.35 -> 1', () => {
      expect(calculateInterest(27)).toBe(1);
    });

    it('rounds 35 * 0.05 = 1.75 -> 2', () => {
      expect(calculateInterest(35)).toBe(2);
    });

    it('returns whole interest when exact: 100 * 0.05 = 5', () => {
      expect(calculateInterest(100)).toBe(5);
    });
  });

  describe('compounding (apply repeatedly month over month)', () => {
    it('compounds 100 over three months', () => {
      // m1: round(100*0.05)=5 -> 105
      // m2: round(105*0.05)=round(5.25)=5 -> 110
      // m3: round(110*0.05)=round(5.5)=6 -> 116
      let balance = 100;
      balance += calculateInterest(balance);
      expect(balance).toBe(105);
      balance += calculateInterest(balance);
      expect(balance).toBe(110);
      balance += calculateInterest(balance);
      expect(balance).toBe(116);
    });

    it('stays flat when the balance is too small to earn rounded interest', () => {
      // 9 * 0.05 = 0.45 -> 0, so a balance of 9 never grows.
      let balance = 9;
      for (let i = 0; i < 12; i++) {
        balance += calculateInterest(balance);
      }
      expect(balance).toBe(9);
    });
  });
});

describe('projectInterest', () => {
  it('projects interest on current savings plus the additional amount', () => {
    // (60 + 40) * 0.05 = 5
    expect(projectInterest(60, 40)).toBe(5);
  });

  it('equals calculateInterest of the summed balance', () => {
    expect(projectInterest(123, 77)).toBe(calculateInterest(200));
  });

  it('projects from a zero starting balance', () => {
    expect(projectInterest(0, 100)).toBe(5);
  });

  it('projects zero when the combined balance is too small to round up', () => {
    expect(projectInterest(0, 9)).toBe(0);
  });
});
