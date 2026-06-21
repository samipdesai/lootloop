// Pure PIN + display-name validation for the Kids form. The create_kid /
// set_kid_pin SQL functions enforce 4–10 digits and a non-blank name and raise
// on violation; we validate first so the form surfaces inline errors instead of
// round-tripping to a raised exception. Kept dependency-free so it unit-tests
// cleanly (no Supabase / RN imports).

export const PIN_MIN = 4;
export const PIN_MAX = 10;
export const NAME_MAX = 60;

// Strip anything that isn't a digit. Used on every keystroke so the field only
// ever holds digits (the number-pad keyboard still lets paste through).
export function sanitizePin(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, PIN_MAX);
}

// Returns an error string, or undefined when the PIN is valid (4–10 digits).
export function validatePin(pin: string): string | undefined {
  if (pin.length === 0) return 'Enter a PIN.';
  if (!/^\d+$/.test(pin)) return 'PIN must be digits only.';
  if (pin.length < PIN_MIN) return `PIN must be at least ${PIN_MIN} digits.`;
  if (pin.length > PIN_MAX) return `PIN must be at most ${PIN_MAX} digits.`;
  return undefined;
}

// Returns an error string, or undefined when the trimmed name is 1–60 chars.
export function validateDisplayName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Give your kid a name.';
  if (trimmed.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters.`;
  return undefined;
}
