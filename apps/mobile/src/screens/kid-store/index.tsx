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
  type Reward,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import tw from '../../lib/tw';
import { canAfford, shortfall } from './affordability';
import { Celebration } from './Celebration';

function BalanceHeader({ balance }: { balance: number | null }) {
  return (
    <View style={tw`mb-4 rounded-card bg-indigo-soft px-5 py-4`}>
      <Text style={tw`font-sans text-[13px] font-bold uppercase text-indigo-ink`}>Your loot</Text>
      <Text style={tw`mt-0.5 font-display text-[30px] font-extrabold text-indigo-ink`}>
        🪙 {balance == null ? '—' : balance.toLocaleString('en-US')}
      </Text>
      <Text style={tw`mt-1 font-sans text-[13px] font-bold text-indigo-strong`}>
        Spend it on a reward — saving up unlocks the big stuff!
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
  onAskBuy,
  onCancel,
  onConfirm,
}: {
  reward: Reward;
  balance: number | null;
  busy: boolean;
  confirming: boolean;
  error: boolean;
  onAskBuy: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const affordable = canAfford(balance, reward.cost);
  const need = shortfall(balance, reward.cost);

  return (
    <View
      style={tw.style(
        'flex-1 overflow-hidden rounded-card bg-surface-card',
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
      <View style={tw`h-[104px] items-center justify-center bg-indigo-soft`}>
        <Text style={tw`text-[52px]`}>{reward.emoji ?? '🎁'}</Text>
      </View>
      <View style={tw`gap-3 px-4 pb-4 pt-3.5`}>
        <View style={tw`gap-1.5`}>
          <Text numberOfLines={2} style={tw`font-display text-[15px] font-extrabold text-ink-900`}>
            {reward.title}
          </Text>
          <View style={tw`flex-row`}>
            <View style={tw`flex-row items-center gap-1 rounded-pill bg-coin-soft px-2.5 py-1`}>
              <Text style={tw`font-number text-[13px] font-extrabold text-coin-ink`}>
                🪙 {reward.cost.toLocaleString('en-US')}
              </Text>
            </View>
          </View>
        </View>

        {confirming ? (
          <View style={tw`gap-2`}>
            <Text style={tw`font-sans text-[13px] font-bold text-ink-700`}>
              Buy for 🪙 {reward.cost.toLocaleString('en-US')}?
            </Text>
            <View style={tw`flex-row gap-2`}>
              <Button size="sm" loading={busy} disabled={busy} onPress={onConfirm}>
                Yes
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onPress={onCancel}>
                No
              </Button>
            </View>
          </View>
        ) : affordable ? (
          <Button size="sm" block onPress={onAskBuy}>
            Buy
          </Button>
        ) : (
          <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>Need 🪙 {need} more</Text>
        )}

        {error ? (
          <Text style={tw`font-sans text-[12px] font-bold text-danger-ink`}>
            Couldn't buy that — try again.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function KidStoreScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
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
        columnWrapperStyle={tw`gap-3`}
        contentContainerStyle={tw.style(
          'gap-3 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[720px]' : '',
        )}
        ListHeaderComponent={
          <View>
            <BalanceHeader balance={balance} />
            {loadError ? (
              <View style={tw`mb-3 rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-12`}>
            <Text style={tw`text-[40px]`}>🛍️</Text>
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No rewards yet — ask a grown-up!
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
