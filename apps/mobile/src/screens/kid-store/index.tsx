// Kid: Reward store (#23 browse) + buy (#24) + celebration (#26), rebuilt to the
// design canvas (11 · Reward store): a "Store" title with a wallet-pill chip, a
// 2-up grid of reward cards (emoji tile + title + CoinBadge cost), Buy → inline
// "Buy for N?" confirm → purchase_reward RPC (atomic, self-authed to the owning
// kid). On success a pure-RN celebration fires and balance/affordability refresh;
// unaffordable rewards dim with a "Need N more" hint.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  listActiveRewards,
  subscribeToTable,
  type Reward,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { CoinBadge, CoinGlyph } from '../../components/ui/money';
import tw from '../../lib/tw';
import { canAfford, shortfall } from './affordability';

const fmt = (n: number) => n.toLocaleString('en-US');

// Wallet-pill chip in the header (orange, coin + spendable balance).
function WalletChip({ balance }: { balance: number | null }) {
  return (
    <View
      style={tw.style('flex-row items-center gap-1.5 self-start rounded-pill bg-orange px-3 py-1.5', {
        shadowColor: '#D85F06',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 3,
      })}
    >
      <CoinGlyph size={18} />
      <Text style={tw`font-number text-[15px] font-extrabold text-white`}>
        {balance == null ? '—' : fmt(balance)}
      </Text>
    </View>
  );
}

function RewardCard({
  reward,
  balance,
  onBuy,
}: {
  reward: Reward;
  balance: number | null;
  onBuy: () => void;
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
      <View style={tw.style('items-center justify-center bg-indigo-soft', { height: 104 })}>
        <Text style={tw`text-[52px]`}>{reward.emoji ?? '🎁'}</Text>
      </View>
      <View style={tw`gap-3 px-4 pb-4 pt-3.5`}>
        <View style={tw`gap-2`}>
          {/* Fixed two-line height so the price + Buy button align across cards
              regardless of whether the title wraps to one line or two. */}
          <Text
            numberOfLines={2}
            style={tw.style('font-display text-[16px] font-extrabold text-ink-900', {
              lineHeight: 21,
              height: 42,
            })}
          >
            {reward.title}
          </Text>
          <CoinBadge amount={reward.cost} size="sm" tone="soft" />
        </View>

        {affordable ? (
          <Button size="sm" block onPress={onBuy}>
            Buy
          </Button>
        ) : (
          <View style={tw`flex-row items-center gap-1`}>
            <Icon name="lock" size={13} color="#A39CAD" />
            <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>Need</Text>
            <CoinGlyph size={13} />
            <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>{need} more</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function KidStoreScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const nav = useShellNav();
  const numColumns = isRegular ? 3 : 2;

  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');

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
    setBalance(wallet.data?.wallet_balance ?? null);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

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
        key={`cols-${numColumns}`}
        keyExtractor={(r) => r.id}
        numColumns={numColumns}
        columnWrapperStyle={tw`gap-3.5`}
        contentContainerStyle={tw.style(
          'gap-3.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[720px]' : '',
        )}
        ListHeaderComponent={
          <View style={tw`mb-1 gap-4`}>
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Store</Text>
              <WalletChip balance={balance} />
            </View>
            {loadError ? (
              <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
                <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-12`}>
            <Icon name="gift" size={40} color="#A39CAD" />
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No rewards yet — ask a grown-up!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RewardCard
            reward={item}
            balance={balance}
            onBuy={() =>
              nav.navigate('ConfirmPurchase', {
                rewardId: item.id,
                title: item.title,
                cost: item.cost,
                emoji: item.emoji,
              })
            }
          />
        )}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
