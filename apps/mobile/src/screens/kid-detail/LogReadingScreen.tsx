// Kid: Log reading (canvas 14). Pushed from Reading. Book title + minutes → logs a
// reading entry (pending parent approval) and returns to the Reading screen.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { createReadingLog } from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { validateLogForm, type LogFormErrors } from '../kid-reading/reading';
import { DetailHeader } from './DetailHeader';

export function LogReadingScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const nav = useShellNav();
  const [bookTitle, setBookTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [errors, setErrors] = useState<LogFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!client || !profile || submitting) return;
    const result = validateLogForm({ bookTitle, minutes });
    setErrors(result.errors);
    if (!result.valid) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await createReadingLog(client, {
      family_id: profile.family_id,
      kid_id: profile.id,
      book_title: result.values.bookTitle,
      minutes: result.values.minutes,
    });
    setSubmitting(false);
    if (err) {
      setError("Couldn't save that. Try again.");
      return;
    }
    nav.goBack();
  };

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-surface-page`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DetailHeader title="Log reading" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw.style('gap-4 px-5 pb-8 pt-2', isRegular ? 'mx-auto w-full max-w-[480px]' : '')}
      >
        <View style={tw`flex-row items-center gap-2`}>
          <Icon name="book-open" size={22} color="#444CCB" />
          <Text style={tw`font-display text-[17px] font-extrabold text-ink-900`}>What did you read?</Text>
        </View>
        <Input
          testID="reading-title-input"
          label="Book title"
          placeholder="What did you read?"
          value={bookTitle}
          onChangeText={setBookTitle}
          maxLength={200}
          autoCapitalize="words"
          error={errors.bookTitle}
          editable={!submitting}
        />
        <Input
          testID="reading-minutes-input"
          label="Minutes"
          placeholder="How many minutes?"
          value={minutes}
          onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          error={errors.minutes}
          editable={!submitting}
        />
        {error ? (
          <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
          </View>
        ) : null}
        <Button testID="log-reading-submit" block size="lg" loading={submitting} disabled={submitting} onPress={() => void submit()}>
          ＋ Log reading
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
