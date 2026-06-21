import { sanitizePin, validatePin, validateDisplayName, PIN_MAX } from './pin';

describe('sanitizePin', () => {
  it('strips non-digit characters', () => {
    expect(sanitizePin('1a2b3c4')).toBe('1234');
    expect(sanitizePin('12-34')).toBe('1234');
    expect(sanitizePin('  5 6 ')).toBe('56');
  });

  it('caps length at PIN_MAX digits', () => {
    expect(sanitizePin('123456789012345')).toBe('1'.repeat(0) + '123456789012345'.slice(0, PIN_MAX));
    expect(sanitizePin('123456789012345').length).toBe(PIN_MAX);
  });

  it('returns empty string for all-non-digit input', () => {
    expect(sanitizePin('abc')).toBe('');
    expect(sanitizePin('')).toBe('');
  });
});

describe('validatePin', () => {
  it('rejects empty', () => {
    expect(validatePin('')).toBe('Enter a PIN.');
  });

  it('rejects fewer than 4 digits', () => {
    expect(validatePin('1')).toMatch(/at least 4/);
    expect(validatePin('123')).toMatch(/at least 4/);
  });

  it('rejects more than 10 digits', () => {
    expect(validatePin('12345678901')).toMatch(/at most 10/);
  });

  it('accepts 4–10 digits', () => {
    expect(validatePin('1234')).toBeUndefined();
    expect(validatePin('0000')).toBeUndefined();
    expect(validatePin('1234567890')).toBeUndefined();
  });
});

describe('validateDisplayName', () => {
  it('rejects blank / whitespace-only', () => {
    expect(validateDisplayName('')).toBe('Give your kid a name.');
    expect(validateDisplayName('   ')).toBe('Give your kid a name.');
  });

  it('rejects names longer than 60 characters', () => {
    expect(validateDisplayName('x'.repeat(61))).toMatch(/under 60/);
  });

  it('accepts a normal name', () => {
    expect(validateDisplayName('Ava')).toBeUndefined();
    expect(validateDisplayName('  Ava  ')).toBeUndefined();
    expect(validateDisplayName('x'.repeat(60))).toBeUndefined();
  });
});
