// Kid: Reading (#27 log entry + #30 log list + streak). A celebratory streak
// header (🔥 current + longest) sits over a "Log reading" form (book title +
// minutes) and the kid's reading-log list (newest first, with a status badge:
// Pending=coin / Approved=mint with the awarded points / Rejected=danger).
// Everything flows through the kid-session client so RLS scopes reads/writes to
// the signed-in kid. Mirrors MyChoresScreen's load / loading / empty / error /
// pull-to-refresh shape; one component tree, adaptive on size class (iPhone
// single column → iPad centered, wider). Slots under KidShell.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  createReadingLog,
  listKidReadingLogs,
  getReadingStreak,
  type ReadingLog,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import tw from '../../lib/tw';
import {
  streakLabel,
  streakCounts,
  minutesLabel,
  statusBadge,
  readOnLabel,
  validateLogForm,
  type BadgeTone,
  type LogFormErrors,
} from './reading';

interface ScreenData {
  logs: ReadingLog[];
  current: number;
  longest: number;
}

// --- Streak header ----------------------------------------------------------

function StreakHeader({ current, longest }: { current: number; longest: number }) {
  return (
    <View
      style={tw.style('flex-row items-center gap-3.5 rounded-card bg-orange-soft px-5 py-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      })}
    >
      <View
        style={tw.style('h-14 w-14 items-center justify-center rounded-full bg-orange', {
          shadowColor: '#D85F06',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 4,
        })}
      >
        <Text style={tw`text-[26px]`}>{current > 0 ? '🔥' : '📚'}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw`font-display text-[20px] font-extrabold text-orange-ink`}>
          {streakLabel(current)}
        </Text>
        <Text style={tw`font-sans text-[13px] font-bold text-orange-strong`}>
          Longest: {longest} {longest === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </View>
  );
}

// --- Log reading form -------------------------------------------------------

function LogForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (bookTitle: string, minutes: number) => Promise<boolean>;
  submitting: boolean;
}) {
  const [bookTitle, setBookTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [errors, setErrors] = useState<LogFormErrors>({});

  const handleSubmit = async () => {
    const result = validateLogForm({ bookTitle, minutes });
    setErrors(result.errors);
    if (!result.valid) return;
    const ok = await onSubmit(result.values.bookTitle, result.values.minutes);
    if (ok) {
      setBookTitle('');
      setMinutes('');
      setErrors({});
    }
  };

  return (
    <View
      style={tw.style('gap-3 rounded-card bg-surface-card p-5', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      })}
    >
      <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>
        📖 Log your reading
      </Text>
      <Input
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
        label="Minutes"
        placeholder="How many minutes?"
        value={minutes}
        onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        error={errors.minutes}
        editable={!submitting}
      />
      <Button block loading={submitting} disabled={submitting} onPress={() => void handleSubmit()}>
        ＋ Log reading
      </Button>
    </View>
  );
}

// --- Reading log row --------------------------------------------------------

const BADGE: Record<BadgeTone, { bg: string; text: string }> = {
  coin: { bg: 'bg-coin-soft', text: 'text-coin-ink' },
  mint: { bg: 'bg-mint-soft', text: 'text-mint-ink' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger-ink' },
};

function LogRow({ log }: { log: ReadingLog }) {
  const badge = statusBadge(log);
  const badgeStyle = BADGE[badge.tone];
  return (
    <View style={tw`flex-row items-center gap-3 rounded-xl bg-surface-card px-4 py-3.5`}>
      <View style={tw`h-11 w-11 items-center justify-center rounded-lg bg-indigo-soft`}>
        <Text style={tw`text-[20px]`}>📚</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text numberOfLines={1} style={tw`font-display text-[15px] font-extrabold text-ink-900`}>
          {log.book_title}
        </Text>
        <Text style={tw`font-sans text-[12px] font-bold text-ink-500`}>
          {minutesLabel(log.minutes)} · {readOnLabel(log.read_on)}
        </Text>
      </View>
      <View style={tw.style('rounded-pill px-3 py-1', badgeStyle.bg)}>
        <Text style={tw.style('font-display text-[13px] font-extrabold', badgeStyle.text)}>
          {badge.label}
        </Text>
      </View>
    </View>
  );
}

// --- Screen -----------------------------------------------------------------

export function KidReadingScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const [data, setData] = useState<ScreenData | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const [logsRes, streakRes] = await Promise.all([
      listKidReadingLogs(client, profile.id),
      getReadingStreak(client, profile.id),
    ]);
    if (logsRes.error || !logsRes.data) {
      setError("Couldn't load your reading. Pull to try again.");
      setData({ logs: [], current: 0, longest: 0 });
      return;
    }
    const { current, longest } = streakCounts(streakRes.error ? null : streakRes.data);
    setData({ logs: logsRes.data, current, longest });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLog = async (bookTitle: string, minutes: number): Promise<boolean> => {
    if (!client || !profile || submitting) return false;
    setSubmitting(true);
    setError('');
    const { error: err } = await createReadingLog(client, {
      family_id: profile.family_id,
      kid_id: profile.id,
      book_title: bookTitle,
      minutes,
    });
    setSubmitting(false);
    if (err) {
      setError("Couldn't save that. Try again.");
      return false;
    }
    await load();
    return true;
  };

  if (data === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#444CCB" />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={data.logs}
        keyExtractor={(log) => log.id}
        contentContainerStyle={tw.style(
          'gap-2.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={
          <View style={tw`gap-3 pb-1`}>
            <StreakHeader current={data.current} longest={data.longest} />
            <LogForm onSubmit={handleLog} submitting={submitting} />
            {error ? (
              <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
              </View>
            ) : null}
            {data.logs.length > 0 ? (
              <Text style={tw`px-1 pt-1 font-display text-[15px] font-extrabold text-ink-800`}>
                Your reading
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-xl bg-surface-card px-6 py-10`}>
            <Text style={tw`text-[40px]`}>📚</Text>
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No reading logged yet — add your first book!
            </Text>
          </View>
        }
        renderItem={({ item }) => <LogRow log={item} />}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
