// Kid: Reward store (#23 browse) + buy (#24) + celebration (#26). The kid sees
// their spendable balance up top and a grid of active rewards (cheapest first).
// Rewards they can afford get a Buy button → inline "Buy X for N? Yes/No" confirm
// → purchase_reward RPC (atomic; deducts loot, records the purchase, self-authed
// to the owning kid in-family). On success a pure-RN Animated celebration fires
// and the balance + grid refresh (affordability re-evaluates). Rewards they can't
// afford are dimmed with a "Need N more" hint. Mirrors MyChoresScreen's kid-
// session loads, FlatList states, busy-per-item action pattern, and twrnc styling.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  listActiveRewards,
  purchaseReward,
  subscribeToTable,
  type Reward,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useAgeModeTheme, type AgeModeTheme } from '../../theme/ageMode';
import { Button } from '../../components/ui/Button';
import tw from '../../lib/tw';
import { canAfford, shortfall } from './affordability';
import { Celebration } from './Celebration';

function BalanceHeader({ balance, theme }: { balance: number | null; theme: AgeModeTheme }) {
  // Age-mode: the spendable-loot number is the screen's hero — it scales big +
  // playful for Simple, compact for Teen. Copy follows gamification too.
  const playful = theme.gamification === 'high';
  return (
    <View
      style={tw.style(`mb-4 rounded-${theme.cardRadius} bg-indigo-soft px-5 py-4`)}
    >
      <Text
        style={tw.style('font-sans font-bold uppercase text-indigo-ink', {
          fontSize: theme.captionSize,
        })}
      >
        Your loot
      </Text>
      <Text
        style={tw.style('mt-0.5 font-display font-extrabold text-indigo-ink', {
          fontSize: theme.titleSize,
        })}
      >
        🪙 {balance == null ? '—' : balance.toLocaleString('en-US')}
      </Text>
      <Text
        style={tw.style('mt-1 font-sans font-bold text-indigo-strong', {
          fontSize: theme.captionSize,
        })}
      >
        {playful
          ? 'Spend it on a reward — saving up unlocks the big stuff! 🎁'
          : theme.gamification === 'low'
            ? 'Spend on a reward, or save toward something bigger.'
            : 'Spend it on a reward — saving up unlocks the big stuff!'}
      </Text>
    </View>
  );
}

function RewardCard({
  reward,
  balance,
  busy,
  confirming,
  error,
  theme,
  onAskBuy,
  onCancel,
  onConfirm,
}: {
  reward: Reward;
  balance: number | null;
  busy: boolean;
  confirming: boolean;
  error: boolean;
  theme: AgeModeTheme;
  onAskBuy: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const affordable = canAfford(balance, reward.cost);
  const need = shortfall(balance, reward.cost);

  // Age-mode: scale the emoji tile + glyph, reward title/cost type, and give the
  // Buy button room to hit the band's touch target — chunky for Simple, tight for
  // Teen. The tile height + emoji are sized off a 104/52px base.
  const tileHeight = Math.round(104 * theme.iconScale);
  const emojiSize = Math.round(52 * theme.iconScale);
  const playful = theme.gamification === 'high';

  return (
    <View
      style={tw.style(
        `flex-1 overflow-hidden rounded-${theme.cardRadius} bg-surface-card`,
        !affordable ? 'opacity-60' : '',
        {
          shadowColor: 'rgba(32,36,58,1)',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 6,
        },
      )}
    >
      <View
        style={tw.style('items-center justify-center bg-indigo-soft', { height: tileHeight })}
      >
        <Text style={{ fontSize: emojiSize }}>{reward.emoji ?? '🎁'}</Text>
      </View>
      <View style={tw`gap-3 px-4 pb-4 pt-3.5`}>
        <View style={tw`gap-1.5`}>
          <Text
            numberOfLines={2}
            style={tw.style('font-display font-extrabold text-ink-900', {
              fontSize: theme.bodySize,
            })}
          >
            {reward.title}
          </Text>
          <View style={tw`flex-row`}>
            <View style={tw`flex-row items-center gap-1 rounded-pill bg-coin-soft px-2.5 py-1`}>
              <Text
                style={tw.style('font-number font-extrabold text-coin-ink', {
                  fontSize: theme.captionSize + 1,
                })}
              >
                🪙 {reward.cost.toLocaleString('en-US')}
              </Text>
            </View>
          </View>
        </View>

        {confirming ? (
          <View style={tw`gap-2`}>
            <Text
              style={tw.style('font-sans font-bold text-ink-700', { fontSize: theme.captionSize + 1 })}
            >
              Buy for 🪙 {reward.cost.toLocaleString('en-US')}?
            </Text>
            <View style={tw.style('flex-row items-center gap-2', { minHeight: theme.touchTarget })}>
              <Button size="sm" loading={busy} disabled={busy} onPress={onConfirm}>
                Yes
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onPress={onCancel}>
                No
              </Button>
            </View>
          </View>
        ) : affordable ? (
          <View style={tw.style('justify-center', { minHeight: theme.touchTarget })}>
            <Button size="sm" block onPress={onAskBuy}>
              {playful ? 'Buy it!' : 'Buy'}
            </Button>
          </View>
        ) : (
          <Text
            style={tw.style('font-sans font-bold text-ink-400', { fontSize: theme.captionSize + 1 })}
          >
            Need 🪙 {need} more
          </Text>
        )}

        {error ? (
          <Text
            style={tw.style('font-sans font-bold text-danger-ink', { fontSize: theme.captionSize })}
          >
            Couldn&apos;t buy that — try again.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function KidStoreScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const t = useAgeModeTheme();
  const numColumns = isRegular ? 3 : 2;

  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // Bumped on each successful purchase to (re)play the celebration overlay.
  const [celebrate, setCelebrate] = useState(0);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setLoadError('');
    const [shop, wallet] = await Promise.all([
      listActiveRewards(client),
      getKidWallet(client, profile.id),
    ]);
    if (shop.error || !shop.data) {
      setLoadError("Couldn't load the store. Pull to try again.");
      setRewards([]);
      return;
    }
    setRewards(shop.data);
    // Wallet read is best-effort: a missing balance just disables Buy (canAfford
    // null-guards), it shouldn't blank the whole store.
    setBalance(wallet.data?.wallet_balance ?? null);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (#41): the kid's wallet updates live when a parent awards points or
  // after a purchase clears (balance + affordability re-evaluate), and the rewards
  // list reflects rewards a parent adds/removes/toggles — no manual refresh. The
  // kid client is already realtime-authed (createKidClient).
  useEffect(() => {
    if (!client || !profile) return;
    const unsubs = [
      subscribeToTable(client, {
        table: 'wallets',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'rewards',
        filter: `family_id=eq.${profile.family_id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

  const buy = async (reward: Reward) => {
    if (!client || !profile || busyId) return;
    setBusyId(reward.id);
    setErrorId(null);
    const { error } = await purchaseReward(client, reward.id, profile.id);
    setBusyId(null);
    if (error) {
      setErrorId(reward.id);
      return;
    }
    setConfirmId(null);
    setCelebrate((n) => n + 1);
    await load();
  };

  if (rewards === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#444CCB" />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={rewards}
        // numColumns is in the key so the list remounts cleanly on rotation
        // (FlatList can't change column count in place).
        key={`cols-${numColumns}`}
        keyExtractor={(r) => r.id}
        numColumns={numColumns}
        columnWrapperStyle={tw.style({ gap: t.gap })}
        contentContainerStyle={tw.style(
          'px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[720px]' : '',
          { gap: t.gap },
        )}
        ListHeaderComponent={
          <View>
            <BalanceHeader balance={balance} theme={t} />
            {loadError ? (
              <View style={tw`mb-3 rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={tw.style(`items-center gap-2 rounded-${t.cardRadius} bg-surface-card px-6 py-12`)}
          >
            <Text
              style={tw.style({
                fontSize: t.gamification === 'high' ? 56 : t.gamification === 'low' ? 32 : 40,
              })}
            >
              🛍️
            </Text>
            <Text
              style={tw.style('text-center font-display font-extrabold text-ink-800', {
                fontSize: t.headingSize,
              })}
            >
              {t.gamification === 'low'
                ? 'No rewards yet — ask a parent to add some.'
                : 'No rewards yet — ask a grown-up!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RewardCard
            reward={item}
            balance={balance}
            busy={busyId === item.id}
            confirming={confirmId === item.id}
            error={errorId === item.id}
            theme={t}
            onAskBuy={() => {
              setErrorId(null);
              setConfirmId(item.id);
            }}
            onCancel={() => setConfirmId(null)}
            onConfirm={() => void buy(item)}
          />
        )}
        refreshing={false}
        onRefresh={() => void load()}
      />
      <Celebration token={celebrate} />
    </View>
  );
}
