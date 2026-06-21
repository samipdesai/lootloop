// RootNavigator (#10). One **stable** root stack lives under NavigationContainer;
// auth state only swaps the active screen (React Navigation's recommended auth
// pattern). Swapping whole navigators under the container — as an earlier
// version did — tears down the navigation context mid-transition and throws
// "Couldn't find a navigation context" when the outgoing auth screen re-renders.
//
// Screen by state:
//   loading                                   -> Splash
//   recovery session                          -> Auth (AuthStack @ ResetPassword)
//   no session                                -> Auth (AuthStack @ Login)
//   session, no parent profile                -> Auth (AuthStack @ Onboarding)
//   session + parent profile                  -> App (ParentShell)
//
// TODO(#10 linking): NavigationContainer `linking` config (set in App.tsx) must
// map two deep links:
//   - email confirmation link -> picked up by the session gate -> Onboarding
//   - password reset link     -> ResetPassword (establishes a recovery session)
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useSession } from '../stores/session';
import { useKidSession } from '../stores/kidSession';
import { SplashScreen } from './SplashScreen';
import { AuthStack, type AuthEntry } from './AuthStack';
import { ParentShell } from './ParentShell';
import { KidShell } from './KidShell';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status, hasParentProfile, isRecovery } = useSession();
  const kid = useKidSession();

  const signedInAsParent = status === 'signedIn' && hasParentProfile && !isRecovery;
  const signedInAsKid = kid.status === 'signedIn';
  // Splash until BOTH session stores have resolved, so we don't flash the auth
  // stack before a persisted kid/parent session rehydrates.
  const loading = status === 'loading' || kid.status === 'loading';

  // A recovery session is not a full login — show the reset screen even though a
  // session technically exists (spec §7).
  const authEntry: AuthEntry = isRecovery
    ? 'reset'
    : status === 'signedIn' && !hasParentProfile
      ? 'onboarding'
      : 'login';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {loading ? (
        <RootStack.Screen name="Splash" component={SplashScreen} />
      ) : signedInAsParent ? (
        <RootStack.Screen name="App" component={ParentShell} />
      ) : signedInAsKid ? (
        <RootStack.Screen name="KidApp" component={KidShell} />
      ) : (
        <RootStack.Screen name="Auth">{() => <AuthStack entry={authEntry} />}</RootStack.Screen>
      )}
    </RootStack.Navigator>
  );
}
