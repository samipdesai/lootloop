// RootNavigator (#10). Branches on session + parent-profile state:
//   loading                                   -> Splash
//   recovery session                          -> AuthStack @ ResetPassword
//   no session                                -> AuthStack @ Login
//   session, no parent profile                -> AuthStack @ Onboarding
//   session + parent profile                  -> ParentShell
// KidShell is wired into the role branch for later tasks; the kid PIN login (#9)
// is deferred, so a kid login path does not exist yet — parents only for now.
//
// TODO(#10 linking): NavigationContainer `linking` config (set in App.tsx) must
// map two deep links:
//   - email confirmation link -> picked up by the session gate -> Onboarding
//   - password reset link     -> ResetPassword (establishes a recovery session)
import { useSession } from '../stores/session';
import { SplashScreen } from './SplashScreen';
import { AuthStack } from './AuthStack';
import { ParentShell } from './ParentShell';

export function RootNavigator() {
  const { status, hasParentProfile, isRecovery } = useSession();

  if (status === 'loading') {
    return <SplashScreen />;
  }

  // A recovery session is not a full login — show the reset screen even though a
  // session technically exists (spec §7).
  if (isRecovery) {
    return <AuthStack entry="reset" />;
  }

  if (status === 'signedOut') {
    return <AuthStack entry="login" />;
  }

  // Signed in: branch on profile presence.
  if (!hasParentProfile) {
    return <AuthStack entry="onboarding" />;
  }

  return <ParentShell />;
}
