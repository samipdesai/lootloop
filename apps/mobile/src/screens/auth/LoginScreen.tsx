import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInParent, mapAuthError } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { GhostLink } from '../../components/ui/GhostLink';
import { AuthFooter } from './AuthFooter';
import { validateEmail, validateLoginPassword } from './validation';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emailError = touched.email ? validateEmail(email) : undefined;
  const passwordError = touched.password ? validateLoginPassword(password) : undefined;
  const canSubmit = !validateEmail(email) && !validateLoginPassword(password) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const { error } = await signInParent(supabase, email.trim(), password);
    if (error) {
      setFormError(mapAuthError(error));
      setSubmitting(false);
      return;
    }
    // Session lands via onAuthStateChange -> RootNavigator routes by profile
    // state (dashboard or onboarding). Keep button busy until that swaps trees.
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to manage your family."
      formError={formError}
      footer={
        <AuthFooter
          prompt="New here? "
          label="Create an account"
          onPress={() => navigation.navigate('Signup')}
        />
      }
    >
      <View style={tw`gap-4`}>
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (formError) setFormError('');
          }}
          onBlur={() => setTouched((s) => ({ ...s, email: true }))}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          editable={!submitting}
        />
        <View style={tw`gap-1.5`}>
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (formError) setFormError('');
            }}
            onBlur={() => setTouched((s) => ({ ...s, password: true }))}
            error={passwordError}
            password
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            editable={!submitting}
          />
          <View style={tw`items-end`}>
            <GhostLink
              label="Forgot password?"
              size="caption"
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </View>
        </View>
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Log in
        </Button>
        {/* OAuth: Sign in with Apple — deferred, see spec §1.4 */}
        <View style={tw`items-center pt-1`}>
          <GhostLink
            label="Kid signing in? Use your family code"
            size="caption"
            onPress={() => navigation.navigate('KidCode')}
          />
        </View>
      </View>
    </AuthScreen>
  );
}
