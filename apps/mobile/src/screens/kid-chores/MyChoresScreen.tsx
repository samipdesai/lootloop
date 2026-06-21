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
  type KidChore,
  type LootLoopClient,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { Button } from '../../components/ui/Button';
import { useSizeClass } from '../../hooks/useSizeClass';
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
  onClaim,
  onComplete,
}: {
  chore: KidChore;
  busy: boolean;
  onClaim: () => void;
  onComplete: () => void;
}) {
  const bucket = bucketOf(chore);
  const needsClaim = chore.assignment === 'shared' && chore.completion_id == null;
  const rejected = chore.status === 'rejected';

  return (
    <View style={tw`flex-row items-center gap-3 rounded-xl bg-surface-card px-4 py-3.5`}>
      <View style={tw`h-11 w-11 items-center justify-center rounded-lg bg-indigo-soft`}>
        <Text style={tw`text-[20px]`}>{bucket === 'done' ? '✅' : '🧹'}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text
          numberOfLines={1}
          style={tw.style(
            'font-display text-[15px] font-extrabold text-ink-900',
            bucket === 'done' ? 'text-ink-400 line-through' : '',
          )}
        >
          {chore.title}
        </Text>
        <View style={tw`flex-row items-center gap-2`}>
          <Text style={tw`font-display text-[13px] font-extrabold text-coin-ink`}>
            🪙 {chore.points}
          </Text>
          {chore.assignment === 'shared' ? (
            <Text style={tw`font-sans text-[12px] font-bold text-indigo-strong`}>shared</Text>
          ) : null}
          {rejected ? (
            <Text style={tw`font-sans text-[12px] font-bold text-danger-ink`}>try again</Text>
          ) : null}
        </View>
      </View>
      {bucket === 'pending' ? (
        <Text style={tw`font-sans text-[13px] font-bold text-warning-ink`}>Pending</Text>
      ) : bucket === 'done' ? (
        <Text style={tw`text-[22px]`}>🎉</Text>
      ) : needsClaim ? (
        <Button size="sm" variant="ghost" loading={busy} disabled={busy} onPress={onClaim}>
          Claim
        </Button>
      ) : (
        <Button size="sm" loading={busy} disabled={busy} onPress={onComplete}>
          Mark done
        </Button>
      )}
    </View>
  );
}

export function MyChoresScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
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
        contentContainerStyle={tw.style(
          'gap-2.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={
          error ? (
            <View style={tw`mb-2 rounded-md bg-danger-soft px-4 py-3`}>
              <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-xl bg-surface-card px-6 py-12`}>
            <Text style={tw`text-[40px]`}>🎉</Text>
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              Nothing to do today — you crushed it!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChoreCard
            chore={item}
            busy={busyId === item.instance_id}
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
