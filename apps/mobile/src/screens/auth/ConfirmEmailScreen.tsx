import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mapAuthError } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { GhostLink } from '../../components/ui/GhostLink';

type Props = NativeStackScreenProps<AuthStackParamList, 'ConfirmEmail'>;

const COOLDOWN_SECONDS = 30;

export function ConfirmEmailScreen({ route, navigation }: Props) {
  const email = route.params?.email;
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const onResend = async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setFormError('');
    setSent(false);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setSending(false);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    setSent(true);
    startCooldown();
  };

  const resendLabel = cooldown > 0 ? `Resend in ${cooldown}s…` : sent ? 'Sent!' : 'Resend email';

  return (
    <AuthScreen title="Check your email" formError={formError}>
      <View className="gap-5">
        <Text className="font-sans text-[16px] font-semibold text-ink-500">
          We sent a confirmation link to{' '}
          <Text className="font-bold text-ink-900">{email || 'your inbox'}</Text>. Click it to
          finish setting up your account.
        </Text>
        <Button
          block
          variant="ghost"
          loading={sending}
          disabled={cooldown > 0 || !email}
          onPress={onResend}
        >
          {resendLabel}
        </Button>
        <View className="items-center">
          <GhostLink label="Back to log in" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </AuthScreen>
  );
}
