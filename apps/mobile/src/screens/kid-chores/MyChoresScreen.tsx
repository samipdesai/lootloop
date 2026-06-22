// Kid: My Chores (#15) + claim/complete flow (#16). Shows today's chores the kid
// can do — their assigned chores plus shared (claimable) ones — grouped into
// To-do / Waiting for approval / Done. Claiming a shared chore and marking any
// chore done both go through the kid-session service (RLS scopes writes to the
// kid's own completions). Mirrors the design's kid Chores screen.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  listKidChores,
  claimChore,
  completeChore,
  subscribeToTable,
  type KidChore,
  type LootLoopClient,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { Button } from '../../components/ui/Button';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useAgeModeTheme, type AgeModeTheme } from '../../theme/ageMode';
import tw from '../../lib/tw';

// Local calendar date (YYYY-MM-DD) — chores are due on a local day.
function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type Bucket = 'todo' | 'pending' | 'done';

function bucketOf(c: KidChore): Bucket {
  if (c.status === 'approved') return 'done';
  if (c.status === 'pending') return 'pending';
  return 'todo'; // null (not started), 'claimed', or 'rejected'
}

function ChoreCard({
  chore,
  busy,
  theme,
  onClaim,
  onComplete,
}: {
  chore: KidChore;
  busy: boolean;
  theme: AgeModeTheme;
  onClaim: () => void;
  onComplete: () => void;
}) {
  const bucket = bucketOf(chore);
  const needsClaim = chore.assignment === 'shared' && chore.completion_id == null;
  const rejected = chore.status === 'rejected';

  // Age-mode: scale the icon tile + emoji, chore-title type, button height and
  // card radius with the band. The tile/emoji are sized off a 44/20px base.
  const tileSize = Math.round(44 * theme.iconScale);
  const emojiSize = Math.round(20 * theme.iconScale);
  const playful = theme.gamification === 'high';

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
        <Text style={{ fontSize: emojiSize }}>{bucket === 'done' ? '✅' : '🧹'}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text
          numberOfLines={1}
          style={tw.style(
            'font-display font-extrabold text-ink-900',
            bucket === 'done' ? 'text-ink-400 line-through' : '',
            { fontSize: theme.bodySize },
          )}
        >
          {chore.title}
        </Text>
        <View style={tw`flex-row items-center gap-2`}>
          <Text
            style={tw.style('font-display font-extrabold text-coin-ink', {
              fontSize: theme.captionSize + 1,
            })}
          >
            🪙 {chore.points}
          </Text>
          {chore.assignment === 'shared' ? (
            <Text
              style={tw.style('font-sans font-bold text-indigo-strong', {
                fontSize: theme.captionSize,
              })}
            >
              shared
            </Text>
          ) : null}
          {rejected ? (
            <Text
              style={tw.style('font-sans font-bold text-danger-ink', {
                fontSize: theme.captionSize,
              })}
            >
              try again
            </Text>
          ) : null}
        </View>
      </View>
      {bucket === 'pending' ? (
        <Text
          style={tw.style('font-sans font-bold text-coin-ink', { fontSize: theme.captionSize + 1 })}
        >
          {playful ? 'Waiting…' : 'Pending'}
        </Text>
      ) : bucket === 'done' ? (
        <Text style={{ fontSize: Math.round(22 * theme.iconScale) }}>{playful ? '🎉' : '✔️'}</Text>
      ) : needsClaim ? (
        <Button size="sm" variant="ghost" loading={busy} disabled={busy} onPress={onClaim}>
          Claim
        </Button>
      ) : (
        <Button size="sm" loading={busy} disabled={busy} onPress={onComplete}>
          {playful ? 'Done!' : 'Mark done'}
        </Button>
      )}
    </View>
  );
}

export function MyChoresScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const t = useAgeModeTheme();
  const [chores, setChores] = useState<KidChore[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const { data, error: err } = await listKidChores(client, profile.id, todayISO());
    if (err || !data) {
      setError("Couldn't load your chores. Pull to try again.");
      setChores([]);
      return;
    }
    setChores(data);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (#41): when a parent approves/rejects this kid's chore the completion
  // row changes — re-load so the chore moves out of To-do live. We also watch
  // chore_instances (family-scoped) so newly-generated instances appear without a
  // manual refresh. The kid client is already realtime-authed (createKidClient).
  useEffect(() => {
    if (!client || !profile) return;
    const unsubs = [
      subscribeToTable(client, {
        table: 'chore_completions',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'chore_instances',
        filter: `family_id=eq.${profile.family_id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

  const runAction = async (
    chore: KidChore,
    action: (c: LootLoopClient, instanceId: string, kidId: string) => Promise<{ error: unknown }>,
  ) => {
    if (!client || !profile || busyId) return;
    setBusyId(chore.instance_id);
    const { error: err } = await action(client, chore.instance_id, profile.id);
    setBusyId(null);
    if (err) {
      setError("That didn't work. Try again.");
      return;
    }
    await load();
  };

  if (chores === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#444CCB" />
      </View>
    );
  }

  const todo = chores.filter((c) => bucketOf(c) === 'todo');
  const pending = chores.filter((c) => bucketOf(c) === 'pending');
  const done = chores.filter((c) => bucketOf(c) === 'done');
  const ordered = [...todo, ...pending, ...done];

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={ordered}
        keyExtractor={(c) => c.instance_id}
        contentContainerStyle={tw.style('px-4 py-4', isRegular ? 'mx-auto w-full max-w-[640px]' : '', {
          gap: t.gap,
        })}
        ListHeaderComponent={
          error ? (
            <View style={tw`mb-2 rounded-md bg-danger-soft px-4 py-3`}>
              <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View
            style={tw.style(`items-center gap-2 rounded-${t.cardRadius} bg-surface-card px-6 py-12`)}
          >
            <Text
              style={tw.style({
                fontSize: t.gamification === 'high' ? 64 : t.gamification === 'low' ? 32 : 44,
              })}
            >
              {t.gamification === 'low' ? '✅' : '🎉'}
            </Text>
            <Text
              style={tw.style('text-center font-display font-extrabold text-ink-800', {
                fontSize: t.headingSize,
              })}
            >
              {t.gamification === 'high'
                ? 'All done — you crushed it! 🎉'
                : t.gamification === 'low'
                  ? 'No chores left today.'
                  : 'Nothing to do today — you crushed it!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChoreCard
            chore={item}
            busy={busyId === item.instance_id}
            theme={t}
            onClaim={() => runAction(item, claimChore)}
            onComplete={() => runAction(item, completeChore)}
          />
        )}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
