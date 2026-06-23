// Type-to-confirm gate for the destructive "Delete family" action (#52). The
// parent must type their family's name EXACTLY before the delete button enables.
// Pure so the matching rule is unit-tested in isolation (confirm.test.ts) without
// mounting the screen.

// True only when `typed` is an exact match for `familyName` after trimming
// surrounding whitespace on the typed value. The comparison is case-sensitive
// and whitespace-sensitive inside the name — deleting everything for the family
// should require deliberate, exact confirmation, not a fuzzy match. An empty or
// whitespace-only `familyName` never matches (nothing to confirm against).
export function matchesFamilyName(typed: string, familyName: string): boolean {
  if (familyName.trim().length === 0) return false;
  return typed.trim() === familyName;
}
