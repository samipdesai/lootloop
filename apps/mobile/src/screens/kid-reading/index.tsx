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
  subscribeToTable,
  type ReadingLog,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useAgeModeTheme, type AgeModeTheme } from '../../theme/ageMode';
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

function StreakHeader({
  current,
  longest,
  theme,
}: {
  current: number;
  longest: number;
  theme: AgeModeTheme;
}) {
  // Age-mode: the flame medallion + streak number scale with the band (oversized
  // and playful for Simple, compact/understated for Teen). The flame is sized off
  // a 56px base medallion / 26px emoji.
  const medallion = Math.round(56 * theme.iconScale);
  const flameSize = Math.round(26 * theme.iconScale);
  const playful = theme.gamification === 'high';
  return (
    <View
      style={tw.style(`flex-row items-center gap-3.5 rounded-${theme.cardRadius} bg-orange-soft px-5 py-4`, {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      })}
    >
      <View
        style={tw.style('items-center justify-center rounded-full bg-orange', {
          width: medallion,
          height: medallion,
          shadowColor: '#D85F06',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 4,
        })}
      >
        <Text style={{ fontSize: flameSize }}>{current > 0 ? '🔥' : '📚'}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text
          style={tw.style('font-display font-extrabold text-orange-ink', {
            fontSize: theme.headingSize,
          })}
        >
          {playful && current > 0 ? `${streakLabel(current)}!` : streakLabel(current)}
        </Text>
        <Text
          style={tw.style('font-sans font-bold text-orange-strong', {
            fontSize: theme.captionSize,
          })}
        >
          {playful ? '🏆 Best: ' : 'Longest: '}
          {longest} {longest === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </View>
  );
}

// --- Log reading form -------------------------------------------------------

function LogForm({
  onSubmit,
  submitting,
  theme,
}: {
  onSubmit: (bookTitle: string, minutes: number) => Promise<boolean>;
  submitting: boolean;
  theme: AgeModeTheme;
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

  // Age-mode: the form heading + field labels scale with the band, and the submit
  // row gets at least the band's touch target so younger kids get a chunkier tap.
  const playful = theme.gamification === 'high';
  return (
    <View
      style={tw.style(`gap-3 rounded-${theme.cardRadius} bg-surface-card p-5`, {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      })}
    >
      <Text
        style={tw.style('font-display font-extrabold text-ink-900', {
          fontSize: theme.headingSize,
        })}
      >
        📖 {playful ? 'Log your reading!' : 'Log your reading'}
      </Text>
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
      <View style={tw.style('justify-center', { minHeight: theme.touchTarget })}>
        <Button block loading={submitting} disabled={submitting} onPress={() => void handleSubmit()}>
          {playful ? '＋ Log it!' : '＋ Log reading'}
        </Button>
      </View>
    </View>
  );
}

// --- Reading log row --------------------------------------------------------

const BADGE: Record<BadgeTone, { bg: string; text: string }> = {
  coin: { bg: 'bg-coin-soft', text: 'text-coin-ink' },
  mint: { bg: 'bg-mint-soft', text: 'text-mint-ink' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger-ink' },
};

function LogRow({ log, theme }: { log: ReadingLog; theme: AgeModeTheme }) {
  const badge = statusBadge(log);
  const badgeStyle = BADGE[badge.tone];
  // Age-mode: scale the icon tile/emoji + the log title type with the band; rows
  // get at least the band's touch target so the list stays comfortably tappable.
  const tileSize = Math.round(44 * theme.iconScale);
  const emojiSize = Math.round(20 * theme.iconScale);
  return (
    <View
      style={tw.style(
        `flex-row items-center gap-3 rounded-${theme.cardRadius} bg-surface-card px-4 py-3.5`,
        { minHeight: theme.touchTarget },
      )}
    >
      <View
        style={tw.style('items-center justify-center rounded-lg bg-indigo-soft', {
          width: tileSize,
          height: tileSize,
        })}
      >
        <Text style={{ fontSize: emojiSize }}>📚</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text
          numberOfLines={1}
          style={tw.style('font-display font-extrabold text-ink-900', {
            fontSize: theme.bodySize,
          })}
        >
          {log.book_title}
        </Text>
        <Text
          style={tw.style('font-sans font-bold text-ink-500', { fontSize: theme.captionSize })}
        >
          {minutesLabel(log.minutes)} · {readOnLabel(log.read_on)}
        </Text>
      </View>
      <View style={tw.style('rounded-pill px-3 py-1', badgeStyle.bg)}>
        <Text
          style={tw.style('font-display font-extrabold', badgeStyle.text, {
            fontSize: theme.captionSize + 1,
          })}
        >
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
  const t = useAgeModeTheme();
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

  // Realtime (#41): when a parent reviews a log its status flips approved/rejected
  // (and points are awarded) — re-load so the badge + awarded points update live.
  // reading_streaks changes when an approval extends/breaks the streak — re-load
  // so the header flame updates. The kid client is already realtime-authed.
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
          'px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
          { gap: t.gap },
        )}
        ListHeaderComponent={
          <View style={tw.style('pb-1', { gap: t.gap })}>
            <StreakHeader current={data.current} longest={data.longest} theme={t} />
            <LogForm onSubmit={handleLog} submitting={submitting} theme={t} />
            {error ? (
              <View style={tw.style(`rounded-${t.cardRadius} bg-danger-soft px-4 py-3`)}>
                <Text
                  style={tw.style('font-sans font-bold text-danger-ink', { fontSize: t.bodySize })}
                >
                  {error}
                </Text>
              </View>
            ) : null}
            {data.logs.length > 0 ? (
              <Text
                style={tw.style('px-1 pt-1 font-display font-extrabold text-ink-800', {
                  fontSize: t.headingSize,
                })}
              >
                Your reading
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={tw.style(`items-center gap-2 rounded-${t.cardRadius} bg-surface-card px-6 py-10`)}
          >
            <Text
              style={{ fontSize: t.gamification === 'high' ? 56 : t.gamification === 'low' ? 34 : 40 }}
            >
              📚
            </Text>
            <Text
              style={tw.style('text-center font-display font-extrabold text-ink-800', {
                fontSize: t.headingSize,
              })}
            >
              {t.gamification === 'high'
                ? 'No reading yet — add your first book! 📖'
                : t.gamification === 'low'
                  ? 'No reading logged yet.'
                  : 'No reading logged yet — add your first book!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <LogRow log={item} theme={t} />}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
