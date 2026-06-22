// Create / Edit kid form (#15). Same component for both modes: `kid` prop
// undefined -> create (requires a PIN), present -> edit (prefill; PIN is rotated
// via the separate Change-PIN action, not here). One component tree; the
// container branches on size class (compact iPhone stretch / regular iPad
// centred Card). create_kid / update_kid raise on blank name or bad PIN — we
// validate first, then surface any raised message gracefully.
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
import { createKid, updateKid, type AgeMode, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { AGE_MODES } from './ageMode';
import {
  NAME_MAX,
  PIN_MAX,
  sanitizePin,
  validateDisplayName,
  validatePin,
} from './pin';

interface KidFormProps {
  kid?: KidProfile;
  onSaved: () => void;
  onCancel: () => void;
}

function Label({ children }: { children: string }) {
  return <Text style={tw`font-sans text-[14px] font-bold text-ink-900`}>{children}</Text>;
}

export function KidForm({ kid, onSaved, onCancel }: KidFormProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const isEdit = !!kid;

  const [displayName, setDisplayName] = useState(kid?.display_name ?? '');
  const [pin, setPin] = useState('');
  const [ageMode, setAgeMode] = useState<AgeMode>(kid?.age_mode ?? 'simple');
  const [birthdate, setBirthdate] = useState('');

  const [touched, setTouched] = useState({ name: false, pin: false, birthdate: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameError = validateDisplayName(displayName);
  // PIN is required on create, omitted on edit (rotated via Change PIN).
  const pinError = isEdit ? undefined : validatePin(pin);
  // Optional birthdate: when present, must be YYYY-MM-DD (the column is a date).
  const trimmedBirthdate = birthdate.trim();
  const birthdateError =
    trimmedBirthdate.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBirthdate)
      ? 'Use the format YYYY-MM-DD.'
      : undefined;

  const canSubmit = !nameError && !pinError && !birthdateError && !submitting;

  const onSubmit = async () => {
    setTouched({ name: true, pin: true, birthdate: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');

    const name = displayName.trim();
    const birth = trimmedBirthdate.length > 0 ? trimmedBirthdate : null;

    if (isEdit && kid) {
      const { error } = await updateKid(supabase, kid.id, {
        display_name: name,
        age_mode: ageMode,
        birthdate: birth,
      });
      setSubmitting(false);
      if (error) {
        setFormError(error.message || 'Could not save the changes. Try again.');
        return;
      }
      onSaved();
      return;
    }

    const { error } = await createKid(supabase, {
      display_name: name,
      pin,
      age_mode: ageMode,
      birthdate: birth,
    });
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'Could not add the kid. Try again.');
      return;
    }
    onSaved();
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[560px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>
          {isEdit ? 'Edit kid' : 'New kid'}
        </Text>
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

      <Input
        label="Name"
        placeholder="e.g. Ava"
        value={displayName}
        onChangeText={(t) => {
          setDisplayName(t);
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched((s) => ({ ...s, name: true }))}
        error={touched.name ? nameError : undefined}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        editable={!submitting}
      />

      {isEdit ? (
        <Text style={tw`font-sans text-[13px] font-semibold text-ink-500`}>
          Use “Change PIN” on the kid’s card to set a new PIN.
        </Text>
      ) : (
        <Input
          label="PIN"
          placeholder="4–10 digits"
          hint="Your kid types this to sign in on their device."
          value={pin}
          onChangeText={(t) => {
            setPin(sanitizePin(t));
            if (formError) setFormError('');
          }}
          onBlur={() => setTouched((s) => ({ ...s, pin: true }))}
          error={touched.pin ? pinError : undefined}
          keyboardType="number-pad"
          maxLength={PIN_MAX}
          password
          editable={!submitting}
        />
      )}

      <View style={tw`gap-2`}>
        <Label>Age mode</Label>
        <Tabs
          tabs={AGE_MODES.map((m) => ({ value: m.value, label: m.label }))}
          value={ageMode}
          onChange={(v) => setAgeMode(v as AgeMode)}
        />
        <Text style={tw`font-sans text-[13px] font-semibold text-ink-500`}>
          {AGE_MODES.find((m) => m.value === ageMode)?.range} years — tailors the kid’s app.
        </Text>
      </View>

      <Input
        label="Birthdate (optional)"
        placeholder="YYYY-MM-DD"
        value={birthdate}
        onChangeText={(t) => {
          setBirthdate(t);
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched((s) => ({ ...s, birthdate: true }))}
        error={touched.birthdate ? birthdateError : undefined}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        {isEdit ? 'Save changes' : 'Add kid'}
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
        {isRegular ? <View style={tw`w-full max-w-[480px]`}>{body}</View> : body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
