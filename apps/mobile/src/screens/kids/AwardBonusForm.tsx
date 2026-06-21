// Award bonus points form (#21). A dedicated per-kid action: writes an ad-hoc
// 'bonus' ledger row + increments the wallet via the award_bonus_points RPC
// (parent-only, self-authorizing). Resolves the signed-in parent's profile id
// (awardedBy) on mount so the submit has it ready. One component tree; container
// branches on size class like KidForm / ChangePinForm.
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { awardBonusPoints, getMyParentProfile, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';

interface AwardBonusFormProps {
  kid: KidProfile;
  // Called with the awarded amount so the parent surface can show an inline
  // confirmation back on the list.
  onSaved: (amount: number) => void;
  onCancel: () => void;
}

const NOTE_MAX = 120;

// Bonus amount must be a positive integer. Strip to digits in the field; the
// validator guards the final value.
function sanitizeAmount(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

function validateAmount(raw: string): string | undefined {
  const n = Number(raw);
  if (!raw || Number.isNaN(n) || n <= 0) return 'Enter a number greater than 0.';
  return undefined;
}

export function AwardBonusForm({ kid, onSaved, onCancel }: AwardBonusFormProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awardedBy, setAwardedBy] = useState<string | null>(null);

  // Resolve the parent profile id once; awardBonusPoints needs it as awardedBy.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await getMyParentProfile(supabase);
      if (active) setAwardedBy(data?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const amountError = validateAmount(amount);
  const canSubmit = !amountError && !!awardedBy && !submitting;

  const onSubmit = async () => {
    setTouched(true);
    if (amountError) return;
    if (!awardedBy) {
      setFormError("Couldn't confirm your account. Try again.");
      return;
    }
    setSubmitting(true);
    setFormError('');
    const trimmedNote = note.trim();
    const { error } = await awardBonusPoints(
      supabase,
      kid.id,
      Number(amount),
      trimmedNote.length > 0 ? trimmedNote : null,
      awardedBy,
    );
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'Could not award the bonus. Try again.');
      return;
    }
    onSaved(Number(amount));
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[480px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Give bonus</Text>
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
        Award bonus points to {kid.display_name}. They’ll land in their wallet right away.
      </Text>

      <Input
        label="Points"
        placeholder="e.g. 50"
        value={amount}
        onChangeText={(t) => {
          setAmount(sanitizeAmount(t));
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched(true)}
        error={touched ? amountError : undefined}
        keyboardType="number-pad"
        maxLength={7}
        editable={!submitting}
      />

      <Input
        label="Note (optional)"
        placeholder="e.g. Great week!"
        value={note}
        onChangeText={(t) => {
          setNote(t);
          if (formError) setFormError('');
        }}
        maxLength={NOTE_MAX}
        editable={!submitting}
      />

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        Give bonus
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
