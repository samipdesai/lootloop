// Create / Edit schedule item form (#36). Same component for both modes: `item`
// prop undefined → create, present → edit (prefill + updateScheduleItem). One
// component tree; the container branches on size class (compact iPhone modal-stack
// feel / regular iPad wider centred card). Times are collected as simple 'HH:MM'
// text fields (number-pad keyboard, no new native deps); days_of_week is a Mon–Sun
// multi-select where selecting nothing means "every day" (stored as []).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createScheduleItem,
  updateScheduleItem,
  getMyParentProfile,
  type ScheduleItem,
  type ScheduleItemInsert,
  type ScheduleItemUpdate,
  type KidProfile,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { WEEKDAYS, canonicalDays, parseHHMM, isAfter, maskTime } from './schedule';

interface ScheduleFormProps {
  item?: ScheduleItem;
  kids: KidProfile[];
  onSaved: () => void;
  onCancel: () => void;
}

function Label({ children }: { children: string }) {
  return <Text style={tw`font-sans text-[14px] font-bold text-ink-900`}>{children}</Text>;
}

// Segmented option pill (kid picker + weekday multi-select).
function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={tw.style(
        'rounded-pill border-2 px-4 py-2',
        selected ? 'border-orange bg-orange-soft' : 'border-ink-200 bg-surface-card',
        disabled ? 'opacity-50' : null,
      )}
    >
      <Text style={tw.style('font-sans text-[14px] font-bold', selected ? 'text-orange-ink' : 'text-ink-700')}>
        {label}
      </Text>
    </Pressable>
  );
}

// Trim seconds off a stored 'HH:MM:SS' so the field prefills as 'HH:MM'.
function toHHMM(time: string | null): string {
  if (!time) return '';
  const m = /^(\d{1,2}:\d{2})/.exec(time);
  return m ? m[1] : '';
}

export function ScheduleForm({ item, kids, onSaved, onCancel }: ScheduleFormProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const isEdit = !!item;

  // Create supports multiple kids (one schedule_item per kid); edit is single-kid
  // (an item belongs to one kid).
  const [kidIds, setKidIds] = useState<string[]>(item?.kid_id ? [item.kid_id] : []);
  const [title, setTitle] = useState(item?.title ?? '');
  const [startTime, setStartTime] = useState(toHHMM(item?.start_time ?? null));
  const [endTime, setEndTime] = useState(toHHMM(item?.end_time ?? null));
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [days, setDays] = useState<number[]>(canonicalDays(item?.days_of_week ?? []));

  const [touched, setTouched] = useState({ title: false, start: false, end: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedTitle = title.trim();
  const titleError =
    trimmedTitle.length === 0
      ? 'Give the item a title.'
      : trimmedTitle.length > 120
        ? 'Keep the title under 120 characters.'
        : undefined;

  const kidError =
    kidIds.length > 0 ? undefined : isEdit ? 'Pick a kid for this item.' : 'Pick at least one kid.';

  // Edit = single kid (tap replaces); create = multi-select toggle.
  const toggleKid = (id: string) => {
    if (isEdit) {
      setKidIds([id]);
      return;
    }
    setKidIds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const startParsed = parseHHMM(startTime);
  const startError = startParsed.ok ? undefined : 'Enter a start time as HH:MM (24-hour).';

  // End time is optional; if present it must be a valid time strictly after start.
  const endParsed = parseHHMM(endTime);
  const endError =
    endTime.trim().length === 0
      ? undefined
      : !endParsed.ok
        ? 'Enter end time as HH:MM (24-hour).'
        : startParsed.ok && !isAfter(startParsed.value, endParsed.value)
          ? 'End time must be after the start time.'
          : undefined;

  const canSubmit = !titleError && !kidError && !startError && !endError && !submitting;

  const toggleDay = (iso: number) => {
    setDays((prev) => canonicalDays(prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]));
  };

  const onSubmit = async () => {
    setTouched({ title: true, start: true, end: true });
    if (!canSubmit || kidIds.length === 0 || !startParsed.ok) return;
    setSubmitting(true);
    setFormError('');

    const trimmedIcon = icon.trim();
    const resolvedEnd = endParsed.ok ? endParsed.value : null;
    const resolvedIcon = trimmedIcon.length > 0 ? trimmedIcon : null;

    if (isEdit && item) {
      const patch: ScheduleItemUpdate = {
        kid_id: kidIds[0],
        title: trimmedTitle,
        start_time: startParsed.value,
        end_time: resolvedEnd,
        icon: resolvedIcon,
        days_of_week: days,
      };
      const { error } = await updateScheduleItem(supabase, item.id, patch);
      setSubmitting(false);
      if (error) {
        setFormError(error.message || 'Could not save the item. Try again.');
        return;
      }
      onSaved();
      return;
    }

    // Create: family_id comes from the signed-in parent's profile. One row per
    // selected kid (schedule_items is one kid per item).
    const { data: profile, error: profileError } = await getMyParentProfile(supabase);
    if (profileError || !profile) {
      setSubmitting(false);
      setFormError('Could not load your family. Try again.');
      return;
    }

    for (const kidId of kidIds) {
      const input: ScheduleItemInsert = {
        family_id: profile.family_id,
        kid_id: kidId,
        title: trimmedTitle,
        start_time: startParsed.value,
        end_time: resolvedEnd,
        icon: resolvedIcon,
        days_of_week: days,
      };
      const { error } = await createScheduleItem(supabase, input);
      if (error) {
        setSubmitting(false);
        setFormError(error.message || 'Could not create the item. Try again.');
        return;
      }
    }
    setSubmitting(false);
    onSaved();
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[560px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>
          {isEdit ? 'Edit item' : 'New item'}
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

      {/* Kid picker — create: pick one or more; edit: single. */}
      <View style={tw`gap-2`}>
        <Label>{isEdit ? 'Kid' : 'Kids'}</Label>
        {!isEdit ? (
          <Text style={tw`font-sans text-[12px] font-semibold text-ink-500`}>
            Pick one or more — the item is added for each.
          </Text>
        ) : null}
        {kids.length === 0 ? (
          <Text style={tw`font-sans text-[13px] font-semibold text-ink-500`}>
            No kids yet — add a kid first.
          </Text>
        ) : (
          <View style={tw`flex-row flex-wrap gap-2`}>
            {kids.map((kid) => (
              <Chip
                key={kid.id}
                label={kid.display_name}
                selected={kidIds.includes(kid.id)}
                disabled={submitting}
                onPress={() => toggleKid(kid.id)}
              />
            ))}
          </View>
        )}
        {touched.title && kidError ? (
          <Text style={tw`font-sans text-[12px] font-semibold text-danger-ink`}>{kidError}</Text>
        ) : null}
      </View>

      <Input
        label="Title"
        placeholder="e.g. Brush teeth"
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

      <View style={tw`flex-row gap-3`}>
        <View style={tw`flex-1`}>
          <Input
            label="Start time"
            placeholder="07:30"
            hint="24-hour, HH:MM"
            value={startTime}
            onChangeText={(t) => {
              setStartTime(maskTime(t));
              if (formError) setFormError('');
            }}
            onBlur={() => setTouched((s) => ({ ...s, start: true }))}
            error={touched.start ? startError : undefined}
            keyboardType="number-pad"
            maxLength={5}
            editable={!submitting}
          />
        </View>
        <View style={tw`flex-1`}>
          <Input
            label="End time"
            placeholder="optional"
            hint="Optional"
            value={endTime}
            onChangeText={(t) => {
              setEndTime(maskTime(t));
              if (formError) setFormError('');
            }}
            onBlur={() => setTouched((s) => ({ ...s, end: true }))}
            error={touched.end ? endError : undefined}
            keyboardType="number-pad"
            maxLength={5}
            editable={!submitting}
          />
        </View>
      </View>

      <Input
        label="Icon"
        placeholder="optional (lucide name)"
        hint="Optional — a lucide icon name, e.g. utensils."
        value={icon}
        onChangeText={setIcon}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />

      {/* Days of week — none selected = every day */}
      <View style={tw`gap-2`}>
        <Label>Repeats on</Label>
        <Text style={tw`font-sans text-[12px] font-semibold text-ink-500`}>
          Leave all unselected for every day.
        </Text>
        <View style={tw`flex-row flex-wrap gap-2`}>
          {WEEKDAYS.map((w) => (
            <Chip
              key={w.iso}
              label={w.short}
              selected={days.includes(w.iso)}
              disabled={submitting}
              onPress={() => toggleDay(w.iso)}
            />
          ))}
        </View>
      </View>

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        {isEdit ? 'Save changes' : 'Create item'}
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
