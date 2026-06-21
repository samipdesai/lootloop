// Change-PIN form (#15). A dedicated action separate from edit: rotating a PIN
// is a distinct, security-sensitive operation (set_kid_pin re-hashes), so it
// gets its own confirm-by-typing screen rather than living in the edit form.
// One component tree; container branches on size class like KidForm.
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setKidPin, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { PIN_MAX, sanitizePin, validatePin } from './pin';

interface ChangePinFormProps {
  kid: KidProfile;
  onSaved: () => void;
  onCancel: () => void;
}

export function ChangePinForm({ kid, onSaved, onCancel }: ChangePinFormProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinError = validatePin(pin);
  const canSubmit = !pinError && !submitting;

  const onSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const { error } = await setKidPin(supabase, kid.id, pin);
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'Could not update the PIN. Try again.');
      return;
    }
    onSaved();
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[480px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Change PIN</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
          disabled={submitting}
          onPress={onCancel}
        >
          <Text style={tw`font-sans text-[15px] font-bold text-ink-500`}>Cancel</Text>
        </Pressable>
      </View>

      <Text style={tw`font-sans text-[15px] font-semibold text-ink-500`}>
        Set a new PIN for {kid.display_name}. They’ll use it to sign in on their device.
      </Text>

      <Input
        label="New PIN"
        placeholder="4–10 digits"
        value={pin}
        onChangeText={(t) => {
          setPin(sanitizePin(t));
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched(true)}
        error={touched ? pinError : undefined}
        keyboardType="number-pad"
        maxLength={PIN_MAX}
        password
        editable={!submitting}
      />

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        Update PIN
      </Button>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-surface-page`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: isRegular ? 'center' : 'stretch',
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {isRegular ? <Card>{body}</Card> : body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
