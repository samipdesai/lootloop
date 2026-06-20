// Client-side validation (spec §6). Returns an error string or '' if valid.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string {
  return EMAIL_RE.test(value.trim()) ? '' : 'Enter a valid email address.';
}

export function validatePasswordPresent(value: string): string {
  return value.length > 0 ? '' : 'Enter your password.';
}

export function validatePasswordStrength(value: string): string {
  return value.length >= 8 ? '' : 'Use at least 8 characters.';
}

export function validateFamilyName(value: string): string {
  const v = value.trim();
  if (!v) return 'Give your family a name.';
  return '';
}

export function validateInviteCode(value: string): string {
  return value.trim() ? '' : 'Enter your invite code.';
}

export function validateDisplayName(value: string): string {
  return value.trim() ? '' : 'Enter your name.';
}
