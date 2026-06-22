// Kid: Reading (#27 log entry + #30 log list + streak), rebuilt to the design
// canvas (13 · Reading): the StreakMeter over a Longest-streak / This-week stats
// row, an inline "Log reading" form (book title + minutes), and a "Recent reads"
// list with a book-spine tile + status badge (Pending=coin / Approved=mint /
// Rejected=danger). Everything flows through the kid-session client (RLS-scoped).
// (The canvas pushes the log form to its own screen #14; kept inline here until
// the kid native-stack lands.)
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  createReadingLog,
  listKidReadingLogs,
  getReadingStreak,
  subscribeToTable,
  type ReadingLog,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { StreakMeter } from '../../components/ui/money';
import tw from '../../lib/tw';
import {
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

// Minutes read in the last 7 days (read_on is a YYYY-MM-DD local date).
function weekMinutes(logs: ReadingLog[]): number {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  return logs.reduce((sum, l) => (new Date(l.read_on) >= since ? sum + l.minutes : sum), 0);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={tw.style('flex-1 rounded-card bg-surface-card px-4 py-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <Text style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-[12px] text-ink-400`}>
        {label}
      </Text>
      <Text style={tw`mt-0.5 font-display text-[26px] font-extrabold text-ink-900`}>{value}</Text>
    </View>
  );
}

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
      <View style={tw`flex-row items-center gap-2`}>
        <Icon name="book-open" size={20} color="#444CCB" />
        <Text style={tw`font-display text-[18px] font-extrabold text-ink-900`}>Log your reading</Text>
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
      <Button block loading={submitting} disabled={submitting} onPress={() => void handleSubmit()}>
        ＋ Log reading
      </Button>
    </View>
  );
}

const BADGE: Record<BadgeTone, { bg: string; text: string }> = {
  coin: { bg: 'bg-coin-soft', text: 'text-coin-ink' },
  mint: { bg: 'bg-mint-soft', text: 'text-mint-ink' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger-ink' },
};

function LogRow({ log }: { log: ReadingLog }) {
  const badge = statusBadge(log);
  const badgeStyle = BADGE[badge.tone];
  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card px-4 py-3.5', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      {/* Book-spine tile */}
      <View style={tw.style('items-center justify-center rounded-xs bg-indigo', { width: 40, height: 52 })}>
        <Icon name="book" size={20} color="#FFFFFF" />
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

  useEffect(() => {
    if (!client || !profile) return;
    const unsubs = [
      subscribeToTable(client, {
        table: 'reading_logs',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'reading_streaks',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

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
          <View style={tw`gap-3.5 pb-1`}>
            <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Reading</Text>
            <StreakMeter days={data.current} goal={7} />
            <View style={tw`flex-row gap-3`}>
              <StatCard label="Longest streak" value={`${data.longest} ${data.longest === 1 ? 'day' : 'days'}`} />
              <StatCard label="This week" value={`${weekMinutes(data.logs)} min`} />
            </View>
            <LogForm onSubmit={handleLog} submitting={submitting} />
            {error ? (
              <View style={tw`rounded-card bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
              </View>
            ) : null}
            {data.logs.length > 0 ? (
              <Text style={tw`mt-1 font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
                Recent reads
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
            <Icon name="book-open" size={40} color="#A39CAD" />
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
