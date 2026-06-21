// Kid login step 3 (#9-client): the kid enters their PIN. We verify it via the
// kid-auth Edge Function, which mints the kid JWT; on success we hand it to the
// kid session store and the RootNavigator swaps to the KidShell.
import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInKid } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { useKidSession } from '../../stores/kidSession';
import { AuthScreen } from '../auth/AuthScreen';
import { AuthFooter } from '../auth/AuthFooter';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'KidPin'>;

export function KidPinScreen({ navigation, route }: Props) {
  const { familyId, profileId, displayName } = route.params;
  const { signIn } = useKidSession();
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = pin.length >= 4 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const { data, error } = await signInKid(supabase, {
      family_id: familyId,
      profile_id: profileId,
      pin,
    });
    if (error || !data) {
      setSubmitting(false);
      setPin('');
      setFormError('That PIN is incorrect. Try again.');
      return;
    }
    // Establishing the kid session swaps the navigator to the KidShell; keep the
    // button busy through that transition (no further navigation needed here).
    await signIn(data);
  };

  return (
    <AuthScreen
      title={`Hi ${displayName}!`}
      subtitle="Enter your PIN to log in."
      formError={formError}
      footer={
        <AuthFooter prompt="Not you? " label="Go back" onPress={() => navigation.goBack()} />
      }
    >
      <View style={tw`gap-4`}>
        <Input
          label="PIN"
          placeholder="••••"
          value={pin}
          onChangeText={(t) => {
            setPin(t.replace(/[^0-9]/g, '').slice(0, 10));
            if (formError) setFormError('');
          }}
          keyboardType="number-pad"
          password
          maxLength={10}
          editable={!submitting}
          textContentType="oneTimeCode"
        />
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Log in
        </Button>
      </View>
    </AuthScreen>
  );
}
