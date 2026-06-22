// Kid: My Chores (#15) + claim/complete flow (#16), rebuilt to match the design
// canvas (08 · My chores): a "Chores" title, a To-do / Pending / Done segmented
// control, and within To-do an "Up for grabs" (claimable shared) section over an
// "Assigned to you" list. Claiming/completing go through the kid-session service
// (RLS scopes writes to the kid's own completions).
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
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import { Segmented } from '../../components/ui/Segmented';
import { useSizeClass } from '../../hooks/useSizeClass';
import tw from '../../lib/tw';

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
  return 'todo';
}

const CHORE_ICONS = new Set(['bed', 'dog', 'utensils', 'book-open', 'trash-2', 'sparkles', 'list-todo']);
function choreIcon(c: KidChore): IconName {
  return (c.icon && CHORE_ICONS.has(c.icon) ? c.icon : 'list-todo') as IconName;
}

// Section label (uppercase, faint) used above chore groups.
function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={tw`mb-2.5 mt-0.5 font-sans text-[13px] font-extrabold uppercase tracking-wide text-ink-400`}>
      {children}
    </Text>
  );
}

function ChoreCard({
  chore,
  busy,
  claimable,
  onClaim,
  onComplete,
}: {
  chore: KidChore;
  busy: boolean;
  claimable: boolean;
  onClaim: () => void;
  onComplete: () => void;
}) {
  const bucket = bucketOf(chore);
  const rejected = chore.status === 'rejected';
  const tileBg = claimable ? 'bg-surface-card' : 'bg-indigo-soft';
  return (
    <View
      style={tw.style(
        `flex-row items-center gap-3 rounded-card px-3.5 py-3.5 ${claimable ? 'bg-indigo-soft' : 'bg-surface-card'}`,
        claimable
          ? null
          : {
              shadowColor: 'rgba(32,36,58,1)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 2,
            },
      )}
    >
      <View style={tw.style(`h-11 w-11 items-center justify-center rounded-md ${tileBg}`)}>
        <Icon name={bucket === 'done' ? 'circle-check-big' : choreIcon(chore)} size={22} color="#5B63E6" />
      </View>
      <View style={tw`min-w-0 flex-1 gap-1`}>
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
          <CoinBadge amount={chore.points} size="sm" tone="plain" />
          {rejected ? (
            <Text style={tw`font-sans text-[12px] font-bold text-danger-ink`}>try again</Text>
          ) : null}
        </View>
      </View>
      {bucket === 'pending' ? (
        <Text style={tw`font-sans text-[13px] font-bold text-coin-ink`}>Pending</Text>
      ) : bucket === 'done' ? (
        <Icon name="circle-check-big" size={22} color="#16B97D" />
      ) : claimable ? (
        <Button size="sm" variant="indigo" loading={busy} disabled={busy} onPress={onClaim}>
          Claim
        </Button>
      ) : (
        <Button
          testID="chore-done"
          size="sm"
          variant="mint"
          loading={busy}
          disabled={busy}
          onPress={onComplete}
        >
          Done
        </Button>
      )}
    </View>
  );
}

export function MyChoresScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const [tab, setTab] = useState<Bucket>('todo');
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

  const inTab = chores.filter((c) => bucketOf(c) === tab);
  const grabs = tab === 'todo' ? inTab.filter((c) => c.assignment === 'shared' && c.completion_id == null) : [];
  const mine = tab === 'todo' ? inTab.filter((c) => !(c.assignment === 'shared' && c.completion_id == null)) : inTab;

  const card = (item: KidChore, claimable: boolean) => (
    <ChoreCard
      chore={item}
      claimable={claimable}
      busy={busyId === item.instance_id}
      onClaim={() => runAction(item, claimChore)}
      onComplete={() => runAction(item, completeChore)}
    />
  );

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={mine}
        keyExtractor={(c) => c.instance_id}
        contentContainerStyle={tw.style(
          'gap-2.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={
          <View style={tw`gap-4`}>
            <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Chores</Text>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { key: 'todo', label: 'To-do' },
                { key: 'pending', label: 'Pending' },
                { key: 'done', label: 'Done' },
              ]}
            />
            {error ? (
              <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
              </View>
            ) : null}
            {grabs.length > 0 ? (
              <View>
                <SectionLabel>Up for grabs</SectionLabel>
                <View style={tw`gap-2.5`}>{grabs.map((c) => <View key={c.instance_id}>{card(c, true)}</View>)}</View>
              </View>
            ) : null}
            {tab === 'todo' && mine.length > 0 ? <SectionLabel>Assigned to you</SectionLabel> : null}
          </View>
        }
        ListEmptyComponent={
          grabs.length === 0 ? (
            <View style={tw`mt-2 items-center gap-2 rounded-card bg-surface-card px-6 py-12`}>
              <Icon name="circle-check-big" size={40} color="#16B97D" />
              <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
                {tab === 'todo'
                  ? 'Nothing to do — you crushed it!'
                  : tab === 'pending'
                    ? 'Nothing waiting for approval.'
                    : 'No finished chores yet.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => card(item, false)}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
