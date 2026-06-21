import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { updatePassword, signOut, mapAuthError } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../stores/session';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { GhostLink } from '../../components/ui/GhostLink';
import { validateNewPassword } from './validation';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation }: Props) {
  const { isRecovery } = useSession();
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordError = touched ? validateNewPassword(password) : undefined;
  const canSubmit = !validateNewPassword(password) && !submitting;

  // Invalid / expired link: no recovery session on mount (spec §5.6).
  if (!isRecovery && !done) {
    return (
      <AuthScreen title="Link expired">
        <View style={tw`gap-5`}>
          <Text style={tw`font-sans text-[16px] font-semibold text-ink-500`}>
            This reset link is invalid or expired.
          </Text>
          <View style={tw`items-center`}>
            <GhostLink
              label="Request a new link"
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </View>
        </View>
      </AuthScreen>
    );
  }

  if (done) {
    return (
      <AuthScreen title="Password updated 🎉">
        <View style={tw`gap-5`}>
          <Text style={tw`font-sans text-[16px] font-semibold text-ink-500`}>
            Your password has been updated. Log in with your new password.
          </Text>
          <Button block onPress={() => navigation.navigate('Login')}>
            Go to log in
          </Button>
        </View>
      </AuthScreen>
    );
  }

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const { error } = await updatePassword(supabase, password);
    if (error) {
      setSubmitting(false);
      setFormError(mapAuthError(error));
      return;
    }
    // The recovery session is intentionally not treated as a full login — sign
    // out so the user re-authenticates (spec §5.6).
    await signOut(supabase);
    setSubmitting(false);
    setDone(true);
  };

  return (
    <AuthScreen
      title="Set a new password"
      subtitle="Choose a new password for your account."
      formError={formError}
    >
      <View style={tw`gap-4`}>
        <Input
          label="New password"
          placeholder="At least 8 characters"
          hint="At least 8 characters."
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (formError) setFormError('');
          }}
          onBlur={() => setTouched(true)}
          error={passwordError}
          password
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          editable={!submitting}
        />
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Save new password
        </Button>
      </View>
    </AuthScreen>
  );
}
