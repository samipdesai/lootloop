import { matchesFamilyName } from './confirm';

describe('matchesFamilyName (Delete family type-to-confirm gate)', () => {
  it('matches only on an exact family name', () => {
    expect(matchesFamilyName('The Desais', 'The Desais')).toBe(true);
  });

  it('stays disabled (false) until the typed text exactly matches', () => {
    expect(matchesFamilyName('', 'The Desais')).toBe(false);
    expect(matchesFamilyName('The', 'The Desais')).toBe(false);
    expect(matchesFamilyName('The Desai', 'The Desais')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(matchesFamilyName('the desais', 'The Desais')).toBe(false);
    expect(matchesFamilyName('THE DESAIS', 'The Desais')).toBe(false);
  });

  it('trims surrounding whitespace on the typed value', () => {
    expect(matchesFamilyName('  The Desais  ', 'The Desais')).toBe(true);
    expect(matchesFamilyName('\tThe Desais\n', 'The Desais')).toBe(true);
  });

  it('is whitespace-sensitive inside the name', () => {
    expect(matchesFamilyName('TheDesais', 'The Desais')).toBe(false);
    expect(matchesFamilyName('The  Desais', 'The Desais')).toBe(false);
  });

  it('never matches an empty or whitespace-only family name', () => {
    expect(matchesFamilyName('', '')).toBe(false);
    expect(matchesFamilyName('   ', '   ')).toBe(false);
    expect(matchesFamilyName('anything', '')).toBe(false);
  });
});
