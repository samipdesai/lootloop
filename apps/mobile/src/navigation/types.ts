// Navigator param lists for the auth stack and the parent shell (#10).

// Single stable root navigator: NavigationContainer always renders this, and
// auth state only swaps the active screen (RN's recommended auth pattern) —
// never swap whole navigators under the container.
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  App: undefined;
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
};

export type ParentTabParamList = {
  Home: undefined;
  Chores: undefined;
  Approvals: undefined;
  Kids: undefined;
  Rewards: undefined;
  Schedule: undefined;
};
