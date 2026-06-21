// Navigator param lists for the auth stack and the parent shell (#10).

import type { KidRoster } from '@lootloop/client';

// Single stable root navigator: NavigationContainer always renders this, and
// auth state only swaps the active screen (RN's recommended auth pattern) —
// never swap whole navigators under the container.
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  App: undefined;
  // Kid session (signed in via family code + PIN, #9-client).
  KidApp: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  // email carried through so the interstitial can show it + drive Resend.
  ConfirmEmail: { email: string };
  ForgotPassword: undefined;
  // Reset is normally reached via deep link (recovery session); kept in-stack so
  // the navigator can route to it. See linking TODOs in RootNavigator.
  ResetPassword: undefined;
  Onboarding: undefined;
  // Kid login flow (#9-client, family-code model): enter family code -> pick
  // your profile from the roster -> enter PIN. Lives in the auth stack so we
  // never swap navigators under the container.
  KidCode: undefined;
  KidRoster: { roster: KidRoster };
  KidPin: { familyId: string; profileId: string; displayName: string };
};

export type ParentTabParamList = {
  Home: undefined;
  Chores: undefined;
  Approvals: undefined;
  Kids: undefined;
  Rewards: undefined;
  Schedule: undefined;
};

// Kid shell tabs (#19/#15/#23). More tabs (savings, reading) land in later tasks.
export type KidTabParamList = {
  Home: undefined;
  Chores: undefined;
  Store: undefined;
};
