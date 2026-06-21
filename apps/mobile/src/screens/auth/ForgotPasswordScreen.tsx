import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset, mapAuthError } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { GhostLink } from '../../components/ui/GhostLink';
import { validateEmail } from './validation';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

// TODO(#10 linking): pass { redirectTo: <reset deep link> } once the navigator's
// linking config defines the reset-password deep link target.
export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError = touched ? validateEmail(email) : undefined;
  const canSubmit = !validateEmail(email) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const trimmed = email.trim();
    const { error } = await requestPasswordReset(supabase, trimmed);
    setSubmitting(false);
    // Neutral copy: only true failures (network/rate-limit) show an error;
    // "no such user" still shows the success panel (spec §5.5, anti-enumeration).
    if (error && (error.status === 429 || !error.status)) {
      setFormError(mapAuthError(error));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthScreen title="Check your email">
        <View style={tw`gap-5`}>
          <Text style={tw`font-sans text-[16px] font-semibold text-ink-500`}>
            If an account exists for{' '}
            <Text style={tw`font-bold text-ink-900`}>{email.trim()}</Text>, we've sent a password
            reset link.
          </Text>
          <View style={tw`items-center`}>
            <GhostLink label="Back to log in" onPress={() => navigation.navigate('Login')} />
          </View>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
      formError={formError}
      footer={<GhostLink label="Back to log in" onPress={() => navigation.navigate('Login')} />}
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
          onBlur={() => setTouched(true)}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          editable={!submitting}
        />
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Send reset link
        </Button>
      </View>
    </AuthScreen>
  );
}
