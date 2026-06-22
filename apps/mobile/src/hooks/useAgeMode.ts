import { useKidSession } from '../stores/kidSession';

export type AgeMode = 'simple' | 'detailed' | 'teen';

// Kid UI branches on age mode (Simple 5-8 / Detailed 9-12 / Teen 13-15). The
// mode lives on the signed-in kid's profile (`kidSession.profile.age_mode`),
// set by the parent when they create/edit the kid. Screens call this to pick
// the right age-mode theme (see theme/ageMode.ts → useAgeModeTheme()).
//
// Defaults to 'detailed' (the balanced middle band) whenever there is no kid
// session — e.g. on parent surfaces, or before a kid has signed in — so any
// component can safely call it without guarding for null.
export function useAgeMode(): AgeMode {
  return useKidSession().profile?.age_mode ?? 'detailed';
}
