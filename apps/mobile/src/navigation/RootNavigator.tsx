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
import { SplashScreen } from './SplashScreen';
import { AuthStack, type AuthEntry } from './AuthStack';
import { ParentShell } from './ParentShell';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status, hasParentProfile, isRecovery } = useSession();

  const signedInAsParent = status === 'signedIn' && hasParentProfile && !isRecovery;

  // A recovery session is not a full login — show the reset screen even though a
  // session technically exists (spec §7).
  const authEntry: AuthEntry = isRecovery
    ? 'reset'
    : status === 'signedIn' && !hasParentProfile
      ? 'onboarding'
      : 'login';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'loading' ? (
        <RootStack.Screen name="Splash" component={SplashScreen} />
      ) : signedInAsParent ? (
        <RootStack.Screen name="App" component={ParentShell} />
      ) : (
        <RootStack.Screen name="Auth">{() => <AuthStack entry={authEntry} />}</RootStack.Screen>
      )}
    </RootStack.Navigator>
  );
}
