import { ageModeTheme } from './ageMode';

describe('ageModeTheme', () => {
  const simple = ageModeTheme('simple');
  const detailed = ageModeTheme('detailed');
  const teen = ageModeTheme('teen');

  it('scales type down across the bands (Simple > Detailed > Teen)', () => {
    expect(simple.titleSize).toBeGreaterThan(detailed.titleSize);
    expect(detailed.titleSize).toBeGreaterThan(teen.titleSize);
    expect(simple.bodySize).toBeGreaterThan(detailed.bodySize);
    expect(detailed.bodySize).toBeGreaterThan(teen.bodySize);
  });

  it('gives the youngest band the largest touch targets + icons', () => {
    expect(simple.touchTarget).toBeGreaterThan(detailed.touchTarget);
    expect(detailed.touchTarget).toBeGreaterThan(teen.touchTarget);
    expect(simple.iconScale).toBeGreaterThan(teen.iconScale);
  });

  it('steps gamification down high → medium → low', () => {
    expect(simple.gamification).toBe('high');
    expect(detailed.gamification).toBe('medium');
    expect(teen.gamification).toBe('low');
    // Teen is understated: no celebratory flourishes.
    expect(simple.celebrate).toBe(true);
    expect(teen.celebrate).toBe(false);
  });

  it('echoes the mode and uses valid radius tokens', () => {
    expect(teen.mode).toBe('teen');
    expect(['md', 'lg', 'xl', '2xl', 'card']).toContain(simple.cardRadius);
  });

  it('falls back to the balanced Detailed band for an unknown mode', () => {
    // @ts-expect-error — exercising the runtime guard for a bad value.
    expect(ageModeTheme('toddler')).toEqual(detailed);
    // @ts-expect-error — null/undefined also falls back.
    expect(ageModeTheme(null)).toEqual(detailed);
  });
});
