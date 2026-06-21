// Kid login step 1 (#9-client, family-code model): the kid (or a grown-up
// helping) types the family code shown in the parent's Kids screen. We resolve
// it to the family roster via the anon family-roster Edge Function, then move on
// to pick a profile. The code is the bearer secret; no session exists yet.
import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bindFamilyByCode } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { AuthScreen } from '../auth/AuthScreen';
import { AuthFooter } from '../auth/AuthFooter';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'KidCode'>;

export function KidCodeScreen({ navigation }: Props) {
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = code.trim().length >= 6 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const { data, error } = await bindFamilyByCode(supabase, code.trim());
    setSubmitting(false);
    if (error || !data) {
      setFormError("That family code didn't work. Check it and try again.");
      return;
    }
    navigation.navigate('KidRoster', { roster: data });
  };

  return (
    <AuthScreen
      title="Enter your family code"
      subtitle="Ask a grown-up for the code in their Kids screen."
      formError={formError}
      footer={
        <AuthFooter
          prompt="Are you a grown-up? "
          label="Log in"
          onPress={() => navigation.navigate('Login')}
        />
      }
    >
      <View style={tw`gap-4`}>
        <Input
          label="Family code"
          placeholder="ABCD2345"
          value={code}
          onChangeText={(t) => {
            // Uppercase to match the code alphabet; the function also uppercases.
            setCode(t.toUpperCase());
            if (formError) setFormError('');
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
          editable={!submitting}
        />
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          Continue
        </Button>
      </View>
    </AuthScreen>
  );
}
