// Age-mode display metadata, shared by the list badge and the form's age-mode
// Tabs. age_mode drives the kid UI branch (useAgeMode): Simple 5–8 / Detailed
// 9–12 / Teen 13–15. Order here is the order shown in the form.
import type { AgeMode } from '@lootloop/client';

export interface AgeModeMeta {
  value: AgeMode;
  label: string; // tab label
  range: string; // age range shown in copy
  badge: string; // compact list-badge text
}

export const AGE_MODES: AgeModeMeta[] = [
  { value: 'simple', label: 'Simple', range: '5–8', badge: 'Simple 5–8' },
  { value: 'detailed', label: 'Detailed', range: '9–12', badge: 'Detailed 9–12' },
  { value: 'teen', label: 'Teen', range: '13–15', badge: 'Teen 13–15' },
];

// age_mode is nullable on the profiles row (set at create time but defensively
// typed as nullable); fall back to the Simple badge when absent.
export function ageModeBadge(mode: AgeMode | null): string {
  return AGE_MODES.find((m) => m.value === mode)?.badge ?? AGE_MODES[0].badge;
}
