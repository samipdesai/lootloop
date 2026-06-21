import type { AgeMode } from '@lootloop/client';

// Age-mode metadata shared by the list badge and the form's segmented picker.
// Order matches the kid UI age bands (Simple 5-8 / Detailed 9-12 / Teen 13-15).
export const AGE_MODES: { value: AgeMode; label: string; range: string }[] = [
  { value: 'simple', label: 'Simple', range: '5–8' },
  { value: 'detailed', label: 'Detailed', range: '9–12' },
  { value: 'teen', label: 'Teen', range: '13–15' },
];

export function ageModeLabel(mode: AgeMode | null): string {
  const m = AGE_MODES.find(x => x.value === mode);
  return m ? `${m.label} ${m.range}` : 'Detailed 9–12';
}
