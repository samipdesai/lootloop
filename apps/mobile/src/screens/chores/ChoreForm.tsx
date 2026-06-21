// Create / Edit chore form (#12). Same component for both modes: `chore` prop
// undefined -> create, present -> edit (prefill + updateChore). One component
// tree; the container branches on size class (compact iPhone modal-stack feel /
// regular iPad wider centred card). Enforces the assignment CHECK constraint and
// builds the exact recurrence_rule strings the #14 generator parses.
import { useMemo, useState } from 'react';
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
  createChore,
  updateChore,
  getMyParentProfile,
  type Chore,
  type ChoreInsert,
  type ChoreUpdate,
  type KidProfile,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import {
  WEEKDAYS,
  buildRecurrenceRule,
  parseRecurrenceRule,
  type RecurrenceKind,
  type Weekday,
} from './recurrence';

interface ChoreFormProps {
  chore?: Chore;
  kids: KidProfile[];
  onSaved: () => void;
  onCancel: () => void;
}

// Small reusable section heading.
function Label({ children }: { children: string }) {
  return <Text style={tw`font-sans text-[14px] font-bold text-ink-900`}>{children}</Text>;
}

// Segmented option pill (used for assignment, kid picker, recurrence kind, weekdays).
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
      <Text
        style={tw.style(
          'font-sans text-[14px] font-bold',
          selected ? 'text-orange-ink' : 'text-ink-700',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoreForm({ chore, kids, onSaved, onCancel }: ChoreFormProps) {
  const sizeClass = useSizeClass();
  const isRegular = sizeClass === 'regular';
  const insets = useSafeAreaInsets();
  const isEdit = !!chore;

  const initialRecurrence = useMemo(
    () => parseRecurrenceRule(chore?.recurrence_rule ?? null),
    [chore?.recurrence_rule],
  );

  const [title, setTitle] = useState(chore?.title ?? '');
  const [points, setPoints] = useState(chore ? String(chore.points) : '');
  const [assignment, setAssignment] = useState<'assigned' | 'shared'>(
    chore?.assignment ?? 'shared',
  );
  const [assignedKidId, setAssignedKidId] = useState<string | null>(
    chore?.assigned_kid_id ?? null,
  );
  const [recurrenceKind, setRecurrenceKind] = useState<RecurrenceKind>(initialRecurrence.kind);
  const [weekdays, setWeekdays] = useState<Weekday[]>(initialRecurrence.days);

  const [touched, setTouched] = useState({ title: false, points: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedTitle = title.trim();
  const titleError =
    trimmedTitle.length === 0
      ? 'Give the chore a title.'
      : trimmedTitle.length > 120
        ? 'Keep the title under 120 characters.'
        : undefined;

  // Points: integer >= 0. Empty / non-integer / negative are invalid.
  const pointsError = /^\d+$/.test(points.trim()) ? undefined : 'Enter a whole number (0 or more).';

  const assignmentError =
    assignment === 'assigned' && !assignedKidId ? 'Pick a kid to assign this chore to.' : undefined;
  const weeklyError =
    recurrenceKind === 'weekly' && weekdays.length === 0
      ? 'Pick at least one day.'
      : undefined;

  const canSubmit =
    !titleError && !pointsError && !assignmentError && !weeklyError && !submitting;

  const toggleWeekday = (code: Weekday) => {
    setWeekdays((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const onSubmit = async () => {
    setTouched({ title: true, points: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');

    const recurrenceRule = buildRecurrenceRule({ kind: recurrenceKind, days: weekdays });
    // Enforce the assignment CHECK constraint: assigned REQUIRES a kid; shared
    // REQUIRES null.
    const resolvedKidId = assignment === 'assigned' ? assignedKidId : null;
    const pointsValue = parseInt(points.trim(), 10);

    if (isEdit && chore) {
      const patch: ChoreUpdate = {
        title: trimmedTitle,
        points: pointsValue,
        assignment,
        assigned_kid_id: resolvedKidId,
        recurrence_rule: recurrenceRule,
      };
      const { error } = await updateChore(supabase, chore.id, patch);
      setSubmitting(false);
      if (error) {
        setFormError(error.message || 'Could not save the chore. Try again.');
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

    const input: ChoreInsert = {
      family_id: profile.family_id,
      title: trimmedTitle,
      points: pointsValue,
      assignment,
      assigned_kid_id: resolvedKidId,
      recurrence_rule: recurrenceRule,
    };
    const { error } = await createChore(supabase, input);
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'Could not create the chore. Try again.');
      return;
    }
    onSaved();
  };

  const body = (
    <View style={tw.style('w-full gap-5', isRegular ? 'max-w-[560px]' : null)}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>
          {isEdit ? 'Edit chore' : 'New chore'}
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
        label="Title"
        placeholder="e.g. Make your bed"
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
        label="Points"
        placeholder="0"
        hint="Whole number, 0 or more."
        value={points}
        onChangeText={(t) => {
          // Keep digits only so the field always parses cleanly.
          setPoints(t.replace(/[^0-9]/g, ''));
          if (formError) setFormError('');
        }}
        onBlur={() => setTouched((s) => ({ ...s, points: true }))}
        error={touched.points ? pointsError : undefined}
        keyboardType="number-pad"
        editable={!submitting}
      />

      {/* Assignment */}
      <View style={tw`gap-2`}>
        <Label>Assignment</Label>
        <View style={tw`flex-row gap-2`}>
          <Chip
            label="Shared"
            selected={assignment === 'shared'}
            disabled={submitting}
            onPress={() => {
              setAssignment('shared');
              setAssignedKidId(null);
            }}
          />
          <Chip
            label="Assigned"
            selected={assignment === 'assigned'}
            disabled={submitting}
            onPress={() => setAssignment('assigned')}
          />
        </View>
        {assignment === 'assigned' ? (
          kids.length === 0 ? (
            <Text style={tw`font-sans text-[13px] font-semibold text-ink-500`}>
              No kids yet — add a kid first, or use Shared.
            </Text>
          ) : (
            <View style={tw`flex-row flex-wrap gap-2`}>
              {kids.map((kid) => (
                <Chip
                  key={kid.id}
                  label={kid.display_name}
                  selected={assignedKidId === kid.id}
                  disabled={submitting}
                  onPress={() => setAssignedKidId(kid.id)}
                />
              ))}
            </View>
          )
        ) : null}
        {assignmentError ? (
          <Text style={tw`font-sans text-[12px] font-semibold text-danger-ink`}>
            {assignmentError}
          </Text>
        ) : null}
      </View>

      {/* Recurrence */}
      <View style={tw`gap-2`}>
        <Label>Repeats</Label>
        <View style={tw`flex-row flex-wrap gap-2`}>
          <Chip
            label="Does not repeat"
            selected={recurrenceKind === 'none'}
            disabled={submitting}
            onPress={() => setRecurrenceKind('none')}
          />
          <Chip
            label="Every day"
            selected={recurrenceKind === 'daily'}
            disabled={submitting}
            onPress={() => setRecurrenceKind('daily')}
          />
          <Chip
            label="Weekly on…"
            selected={recurrenceKind === 'weekly'}
            disabled={submitting}
            onPress={() => setRecurrenceKind('weekly')}
          />
        </View>
        {recurrenceKind === 'weekly' ? (
          <View style={tw`flex-row flex-wrap gap-2`}>
            {WEEKDAYS.map((w) => (
              <Chip
                key={w.code}
                label={w.short}
                selected={weekdays.includes(w.code)}
                disabled={submitting}
                onPress={() => toggleWeekday(w.code)}
              />
            ))}
          </View>
        ) : null}
        {weeklyError ? (
          <Text style={tw`font-sans text-[12px] font-semibold text-danger-ink`}>
            {weeklyError}
          </Text>
        ) : null}
      </View>

      {formError ? <FormError message={formError} /> : null}

      <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
        {isEdit ? 'Save changes' : 'Create chore'}
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
