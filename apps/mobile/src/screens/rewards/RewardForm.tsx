// Create / Edit reward form (#22). One component for both modes: `reward` prop
// undefined -> create (family_id resolved from the signed-in parent's profile),
// present -> edit (prefill + updateReward). One component tree; the container
// branches on size class (compact iPhone full-bleed / regular iPad centred card).
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
import {
  createReward,
  updateReward,
  getMyParentProfile,
  type Reward,
  type RewardInsert,
  type RewardUpdate,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';

interface RewardFormProps {
  reward?: Reward;
  onSaved: () => void;
  onCancel: () => void;
}

function Label({ children }: { children: string }) {
  return <Text style={tw`font-sans text-[14px] font-bold text-ink-900`}>{children}</Text>;
}

export function RewardForm({ reward, onSaved, onCancel }: RewardFormProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const isEdit = !!reward;

  const [title, setTitle] = useState(reward?.title ?? '');
  const [cost, setCost] = useState(reward ? String(reward.cost) : '');
  const [emoji, setEmoji] = useState(reward?.emoji ?? '');
  const [active, setActive] = useState(reward?.active ?? true);

  const [touched, setTouched] = useState({ title: false, cost: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedTitle = title.trim();
  const titleError =
    trimmedTitle.length === 0
      ? 'Give the reward a name.'
      : trimmedTitle.length > 120
        ? 'Keep the name under 120 characters.'
        : undefined;

  // Cost: integer >= 0. Empty / non-integer / negative are invalid.
  const costError = /^\d+$/.test(cost.trim()) ? undefined : 'Enter a whole number (0 or more).';

  const canSubmit = !titleError && !costError && !submitting;

  const onSubmit = async () => {
    setTouched({ title: true, cost: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');

    const costValue = parseInt(cost.trim(), 10);
    const trimmedEmoji = emoji.trim();
    const emojiValue = trimmedEmoji.length > 0 ? trimmedEmoji : null;

    if (isEdit && reward) {
      const patch: RewardUpdate = {
        title: trimmedTitle,
        cost: costValue,
        emoji: emojiValue,
        active,
      };
      const { error } = await updateReward(supabase, reward.id, patch);
      setSubmitting(false);
      if (error) {
        setFormError(error.message || 'Could not save the reward. Try again.');
        return;
      }
      onSaved();
      return;
    }

    // Create: family_id comes from the signed-in parent's profile.
    const { data: profile, error: profileError } = await getMyParentProfile(supabase);
    if (profileError || !profile) {
      setSubmitting(false);
      setFormError('Could not load your family. Try again.');
      return;
    }

    const input: RewardInsert = {
      family_id: profile.family_id,
      title: trimmedTitle,
      cost: costValue,
      emoji: emojiValue,
      active,
    };
    const { error } = await createReward(supabase, input);
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'Could not create the reward. Try again.');
      return;
    }
    onSaved();
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[560px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>
          {isEdit ? 'Edit reward' : 'New reward'}
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
        placeholder="e.g. Movie night"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched((s) => ({ ...s, title: true }))}
        error={touched.title ? titleError : undefined}
        maxLength={120}
        autoCapitalize="sentences"
        editable={!submitting}
      />

      <Input
        label="Cost"
        placeholder="0"
        hint="Coins the kid spends. Whole number, 0 or more."
        value={cost}
        onChangeText={(t) => {
          // Keep digits only so the field always parses cleanly.
          setCost(t.replace(/[^0-9]/g, ''));
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched((s) => ({ ...s, cost: true }))}
        error={touched.cost ? costError : undefined}
        keyboardType="number-pad"
        editable={!submitting}
      />

      <Input
        label="Emoji (optional)"
        placeholder="🎁"
        hint="Shows on the reward card."
        value={emoji}
        onChangeText={(t) => {
          setEmoji(t);
          if (formError) setFormError('');
        }}
        maxLength={8}
        editable={!submitting}
      />

      {/* Active toggle */}
      <View style={tw`gap-2`}>
        <Label>Visible in the store</Label>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: active, disabled: submitting }}
          accessibilityLabel="Active in the store"
          disabled={submitting}
          onPress={() => {
            setActive((v) => !v);
            if (formError) setFormError('');
          }}
          style={tw.style(
            'flex-row items-center justify-between rounded-lg border-2 bg-surface-card px-4 py-3',
            active ? 'border-mint' : 'border-ink-200',
            submitting ? 'opacity-50' : null,
          )}
        >
          <Text style={tw`font-sans text-[15px] font-bold text-ink-900`}>
            {active ? 'Active — kids can buy it' : 'Hidden — kids can’t see it'}
          </Text>
          <View
            style={tw.style(
              'h-7 w-12 justify-center rounded-pill px-0.5',
              active ? 'bg-mint' : 'bg-ink-200',
            )}
          >
            <View
              style={tw.style(
                'h-6 w-6 rounded-pill bg-surface-card',
                active ? 'self-end' : 'self-start',
              )}
            />
          </View>
        </Pressable>
      </View>

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        {isEdit ? 'Save changes' : 'Create reward'}
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
