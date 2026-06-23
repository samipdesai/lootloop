// Kid Dashboard — the kid's home (#19), rebuilt to match the design canvas (07 ·
// Home · dashboard): a wallet BalancePill, a Savings + Store shortcut row, the
// reading StreakMeter, then "Today's chores" with a progress bar and chore cards
// the kid can mark done inline. Reads through the kid-session client so RLS scopes
// it to the signed-in kid. Adaptive: single column on iPhone, centered on iPad.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import {
  getKidWallet,
  getReadingStreak,
  listKidChores,
  claimChore,
  completeChore,
  subscribeToTable,
  type KidChore,
  type LootLoopClient,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { BalancePill, CoinBadge, ProgressBar, StreakMeter } from '../../components/ui/money';
import tw from '../../lib/tw';

function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface DashboardData {
  walletBalance: number;
  savingsBalance: number;
  streak: number;
  chores: KidChore[];
}

const isDone = (c: KidChore) => c.status === 'approved';

// A lucide icon name for a chore. Chore.icon stores a design icon id when set;
// otherwise fall back to a neutral task glyph.
const CHORE_ICONS = new Set<string>([
  'bed',
  'dog',
  'utensils',
  'book-open',
  'trash-2',
  'sparkles',
  'list-todo',
]);
function choreIcon(c: KidChore): IconName {
  return (c.icon && CHORE_ICONS.has(c.icon) ? c.icon : 'list-todo') as IconName;
}

// Savings / Store shortcut card (mint / coin tinted), taps to its tab.
function ShortcutCard({
  icon,
  tint,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  tint: 'mint' | 'coin';
  label: string;
  value: React.ReactNode;
  onPress: () => void;
}) {
  const bg = tint === 'mint' ? 'bg-mint-soft' : 'bg-coin-soft';
  const fg = tint === 'mint' ? '#0A6A46' : '#8A6400';
  return (
    <Pressable
      onPress={onPress}
      style={tw.style(`flex-1 flex-row items-center gap-2.5 rounded-card px-3.5 py-3.5 ${bg}`, {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <Icon name={icon} size={26} color={fg} />
      <View style={tw`min-w-0`}>
        <Text style={tw.style('font-sans text-[12px] font-extrabold', { color: fg, opacity: 0.85 })}>
          {label}
        </Text>
        {value}
      </View>
    </Pressable>
  );
}

function ChoreRow({
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
  const needsClaim = chore.assignment === 'shared' && chore.completion_id == null;
  const pending = chore.status === 'pending';
  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card px-3.5 py-3.5', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <View style={tw`h-11 w-11 items-center justify-center rounded-md bg-indigo-soft`}>
        <Icon name={choreIcon(chore)} size={22} color="#5B63E6" />
      </View>
      <View style={tw`min-w-0 flex-1 gap-1`}>
        <Text numberOfLines={1} style={tw`font-display text-[15px] font-extrabold text-ink-900`}>
          {chore.title}
        </Text>
        <CoinBadge amount={chore.points} size="sm" tone="plain" />
      </View>
      {pending ? (
        <Text style={tw`font-sans text-[13px] font-bold text-coin-ink`}>Pending</Text>
      ) : needsClaim ? (
        <Button size="sm" variant="indigo" loading={busy} disabled={busy} onPress={onClaim}>
          Claim
        </Button>
      ) : (
        <Button size="sm" variant="mint" loading={busy} disabled={busy} onPress={onComplete}>
          Done
        </Button>
      )}
    </View>
  );
}

export function KidDashboardScreen() {
  const { client, profile } = useKidSession();
  const nav = useShellNav();
  const isRegular = useSizeClass() === 'regular';
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const [walletRes, choresRes, streakRes] = await Promise.all([
      getKidWallet(client, profile.id),
      listKidChores(client, profile.id, todayISO()),
      getReadingStreak(client, profile.id),
    ]);
    if (walletRes.error || choresRes.error) {
      setError("Couldn't load your loot. Pull to try again.");
      setData({ walletBalance: 0, savingsBalance: 0, streak: 0, chores: [] });
      return;
    }
    setData({
      walletBalance: walletRes.data?.wallet_balance ?? 0,
      savingsBalance: walletRes.data?.savings_balance ?? 0,
      streak: streakRes.data?.current_streak ?? 0,
      chores: choresRes.data ?? [],
    });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (#41): wallet, this kid's chore completions, new instances, and the
  // reading streak all refresh the home live. Kid client is realtime-authed.
  useEffect(() => {
    if (!client || !profile) return;
    const f = `kid_id=eq.${profile.id}`;
    const unsubs = [
      subscribeToTable(client, { table: 'wallets', filter: f, onChange: () => void load() }),
      subscribeToTable(client, {
        table: 'chore_completions',
        filter: f,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'chore_instances',
        filter: `family_id=eq.${profile.family_id}`,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'reading_streaks',
        filter: f,
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

  if (!client || !profile || data === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#F4720E" />
      </View>
    );
  }

  const open = data.chores.filter((c) => !isDone(c));
  const doneCount = data.chores.filter(isDone).length;
  const total = data.chores.length;

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={open}
        keyExtractor={(c) => c.instance_id}
        contentContainerStyle={tw.style(
          'gap-2.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={
          <View style={tw`gap-4`}>
            {error ? (
              <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              testID="wallet-pill"
              accessibilityRole="button"
              accessibilityLabel="Wallet history"
              onPress={() => nav.navigate('WalletHistory')}
            >
              <BalancePill amount={data.walletBalance} label="Wallet" tone="orange" />
            </Pressable>
            <View style={tw`flex-row gap-3`}>
              <ShortcutCard
                icon="piggy-bank"
                tint="mint"
                label="Savings"
                value={<CoinBadge amount={data.savingsBalance} size="sm" tone="plain" />}
                onPress={() => nav.navigate('Savings')}
              />
              <ShortcutCard
                icon="gift"
                tint="coin"
                label="Store"
                value={
                  <Text style={tw`font-display text-[15px] font-extrabold text-coin-ink`}>
                    Spend loot
                  </Text>
                }
                onPress={() => nav.navigate('Store')}
              />
            </View>
            <StreakMeter days={data.streak} goal={7} />
            <Pressable
              testID="schedule-card"
              accessibilityRole="button"
              accessibilityLabel="Today's schedule"
              onPress={() => nav.navigate('TodaySchedule')}
              style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card px-4 py-3.5', {
                shadowColor: 'rgba(32,36,58,1)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
              })}
            >
              <View style={tw`h-10 w-10 items-center justify-center rounded-md bg-mint-soft`}>
                <Icon name="calendar-clock" size={22} color="#0A6A46" />
              </View>
              <Text style={tw`flex-1 font-display text-[15px] font-extrabold text-ink-900`}>Today&apos;s schedule</Text>
              <Icon name="chevron-right" size={20} color="#A39CAD" />
            </Pressable>
            <View style={tw`mt-1 flex-row items-center justify-between`}>
              <Text style={tw`font-display text-[19px] font-extrabold text-ink-900`}>
                Today&apos;s chores
              </Text>
              {total > 0 ? (
                <Text style={tw`font-sans text-[13px] font-extrabold text-ink-500`}>
                  {doneCount}/{total} done
                </Text>
              ) : null}
            </View>
            {total > 0 ? <ProgressBar value={doneCount} max={total} tone="mint" /> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={tw`mt-2 items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
            <Icon name="circle-check-big" size={40} color="#16B97D" />
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              {total === 0 ? 'No chores today — enjoy!' : 'All done — you crushed it!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChoreRow
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
