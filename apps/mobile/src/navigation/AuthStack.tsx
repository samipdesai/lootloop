// Unauthenticated stack: the six parent-auth screens (#8). Rendered by
// RootNavigator when there is no session, or a session with no parent profile,
// or a recovery session (reset-password).
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ConfirmEmailScreen } from '../screens/auth/ConfirmEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { KidCodeScreen } from '../screens/kid-login/KidCodeScreen';
import { KidRosterScreen } from '../screens/kid-login/KidRosterScreen';
import { KidPinScreen } from '../screens/kid-login/KidPinScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

// `initial` decides the first screen: a session-with-no-profile must land on
// Onboarding; a recovery session on ResetPassword; otherwise Login.
export type AuthEntry = 'login' | 'onboarding' | 'reset';

export function AuthStack({ entry }: { entry: AuthEntry }) {
  const initialRouteName: keyof AuthStackParamList =
    entry === 'onboarding' ? 'Onboarding' : entry === 'reset' ? 'ResetPassword' : 'Login';

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="KidCode" component={KidCodeScreen} />
      <Stack.Screen name="KidRoster" component={KidRosterScreen} />
      <Stack.Screen name="KidPin" component={KidPinScreen} />
    </Stack.Navigator>
  );
}
