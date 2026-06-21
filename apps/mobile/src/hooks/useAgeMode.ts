export type AgeMode = 'simple' | 'detailed' | 'teen';

// Kid UI branches on age mode (Simple 5-8 / Detailed 9-12 / Teen 13-15).
// Placeholder for now: kid surfaces are built in later tasks (#38+). Returns a
// sensible interim default; will read the kid profile's birthdate/age once the
// kid flow exists.
export function useAgeMode(): AgeMode {
  // TODO(#38): derive from the active kid profile's age.
  return 'detailed';
}
