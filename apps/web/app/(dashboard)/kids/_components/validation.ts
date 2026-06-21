// Mirrors the SQL function checks so the form fails fast with friendly copy
// before hitting the RPC (which raises on blank name / bad PIN).

export const NAME_MAX = 60;

export function validateDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1) return 'Give your kid a name.';
  if (trimmed.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
  return '';
}

// PIN: 4–10 digits, numeric only (SQL fn enforces this; we validate up front).
export function validatePin(pin: string): string {
  if (!/^\d+$/.test(pin)) return 'PIN can only contain numbers.';
  if (pin.length < 4 || pin.length > 10) return 'PIN must be 4–10 digits.';
  return '';
}
