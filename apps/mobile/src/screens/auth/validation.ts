// Client-side validation for the parent-auth forms (spec §6). Returns an error
// string or undefined. Trim happens at the call site for names/email/code;
// passwords are never trimmed.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validateLoginPassword(value: string): string | undefined {
  if (value.length === 0) return 'Enter your password.';
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  if (value.length < 8) return 'Use at least 8 characters.';
  return undefined;
}

export function validateFamilyName(value: string): string | undefined {
  const v = value.trim();
  if (v.length === 0 || v.length > 40) return 'Give your family a name.';
  return undefined;
}

export function validateInviteCode(value: string): string | undefined {
  if (value.trim().length === 0) return 'Enter your invite code.';
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  const v = value.trim();
  if (v.length === 0 || v.length > 30) return 'Enter your name.';
  return undefined;
}
