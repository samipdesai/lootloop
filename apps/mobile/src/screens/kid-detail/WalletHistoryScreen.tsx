// Kid: Wallet history (canvas 10). Pushed from Home (tap the wallet). The wallet
// balance over the point-transaction ledger — chores/reading earn, bonuses, and
// store spends — each with a tonal icon tile and a signed coin amount.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  listPointTransactions,
  subscribeToTable,
  type PointTransaction,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Icon, type IconName } from '../../components/ui/Icon';
import { BalancePill, CoinGlyph } from '../../components/ui/money';
import tw from '../../lib/tw';
import { relativeDate } from '../kid-savings/format';
import { DetailHeader } from './DetailHeader';

const fmt = (n: number) => Math.abs(n).toLocaleString('en-US');

// Map a point transaction to its display tile (icon + tone) and label.
function meta(txn: PointTransaction): { icon: IconName; tile: string; fg: string; label: string } {
  if (txn.type === 'spend') return { icon: 'gift', tile: 'bg-coin-soft', fg: '#8A6400', label: 'Store' };
  if (txn.type === 'bonus') return { icon: 'star', tile: 'bg-orange-soft', fg: '#8A4309', label: 'Bonus' };
  if (txn.reading_log_id) return { icon: 'book-open', tile: 'bg-indigo-soft', fg: '#444CCB', label: 'Reading' };
  if (txn.chore_completion_id) return { icon: 'circle-check-big', tile: 'bg-mint-soft', fg: '#0A6A46', label: 'Chore' };
  return { icon: 'circle-check-big', tile: 'bg-mint-soft', fg: '#0A6A46', label: 'Earned' };
}

function Row({ txn }: { txn: PointTransaction }) {
  const m = meta(txn);
  const spend = txn.type === 'spend';
  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-lg bg-surface-card px-4 py-3', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <View style={tw.style(`h-9 w-9 items-center justify-center rounded-md ${m.tile}`)}>
        <Icon name={m.icon} size={20} color={m.fg} />
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text numberOfLines={1} style={tw`font-display text-[14px] font-extrabold text-ink-900`}>
          {m.label}
          {txn.note ? ` · ${txn.note}` : ''}
        </Text>
        <Text style={tw`font-sans text-[12px] font-bold text-ink-400`}>{relativeDate(txn.created_at)}</Text>
      </View>
      {spend ? (
        <Text style={tw`font-number text-[14px] font-extrabold text-danger-ink`}>−{fmt(txn.amount)}</Text>
      ) : (
        <View style={tw`flex-row items-center gap-1`}>
          <Text style={tw`font-number text-[14px] font-extrabold text-mint-ink`}>+</Text>
          <CoinGlyph size={14} />
          <Text style={tw`font-number text-[14px] font-extrabold text-mint-ink`}>{fmt(txn.amount)}</Text>
        </View>
      )}
    </View>
  );
}

export function WalletHistoryScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<PointTransaction[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const [wallet, list] = await Promise.all([
      getKidWallet(client, profile.id),
      listPointTransactions(client, profile.id),
    ]);
    if (wallet.error || !wallet.data || list.error || !list.data) {
      setError("Couldn't load your wallet. Pull to try again.");
      setBalance(0);
      setTxns([]);
      return;
    }
    setBalance(wallet.data.wallet_balance);
    setTxns(list.data);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!client || !profile) return;
    const unsubs = [
      subscribeToTable(client, { table: 'wallets', filter: `kid_id=eq.${profile.id}`, onChange: () => void load() }),
      subscribeToTable(client, {
        table: 'point_transactions',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <DetailHeader title="Wallet" />
      {txns === null ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color="#F4720E" />
        </View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={tw.style('gap-2 px-5 pb-8', isRegular ? 'mx-auto w-full max-w-[640px]' : '')}
          ListHeaderComponent={
            <View style={tw`gap-3 pb-1`}>
              <BalancePill amount={balance ?? 0} label="Wallet" tone="orange" />
              {error ? (
                <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
                  <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
                </View>
              ) : null}
              {txns.length > 0 ? (
                <Text style={tw`mt-1 font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
                  Recent activity
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
              <Icon name="circle-check-big" size={40} color="#A39CAD" />
              <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
                No loot yet — finish a chore to start earning!
              </Text>
            </View>
          }
          renderItem={({ item }) => <Row txn={item} />}
          refreshing={false}
          onRefresh={() => void load()}
        />
      )}
    </View>
  );
}
