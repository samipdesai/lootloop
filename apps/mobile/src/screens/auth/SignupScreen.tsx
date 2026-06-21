import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signUpParent, mapAuthError } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthFooter } from './AuthFooter';
import { validateEmail, validateNewPassword } from './validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emailError = touched.email ? validateEmail(email) : undefined;
  const passwordError = touched.password ? validateNewPassword(password) : undefined;
  const canSubmit = !validateEmail(email) && !validateNewPassword(password) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const trimmed = email.trim();
    // Email confirmation is ON -> no session is returned. Route to the
    // Check-your-email interstitial (spec §1.1 / §5.4).
    const { error } = await signUpParent(supabase, trimmed, password);
    setSubmitting(false);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    navigation.navigate('ConfirmEmail', { email: trimmed });
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Start managing chores & rewards."
      formError={formError}
      footer={
        <AuthFooter
          prompt="Already have an account? "
          label="Log in"
          onPress={() => navigation.navigate('Login')}
        />
      }
    >
      <View className="gap-4">
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
        <Input
          label="Password"
          placeholder="At least 8 characters"
          hint="At least 8 characters."
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
          textContentType="newPassword"
          autoComplete="new-password"
          editable={!submitting}
        />
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Create account
        </Button>
        {/* OAuth: Sign in with Apple — deferred, see spec §1.4 */}
      </View>
    </AuthScreen>
  );
}
