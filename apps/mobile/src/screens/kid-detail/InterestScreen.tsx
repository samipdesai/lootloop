// Kid: Interest & history (canvas 17). Pushed from Savings. A mint "how interest
// works" explainer (5%/month teaching rate, with a live example off the kid's own
// savings) over the savings-transaction ledger.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  listSavingsTransactions,
  subscribeToTable,
  type SavingsTransaction,
} from '@lootloop/client';
import { projectInterest } from '@lootloop/domain';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinGlyph } from '../../components/ui/money';
import tw from '../../lib/tw';
import { relativeDate } from '../kid-savings/format';
import { DetailHeader } from './DetailHeader';

const fmt = (n: number) => Math.abs(n).toLocaleString('en-US');

const TYPE_META: Record<SavingsTransaction['type'], { label: string; icon: IconName }> = {
  deposit: { label: 'Added to savings', icon: 'arrow-down' },
  withdraw: { label: 'Withdrew to wallet', icon: 'arrow-down' },
  interest: { label: 'Interest earned', icon: 'sparkles' },
};

function Row({ txn }: { txn: SavingsTransaction }) {
  const m = TYPE_META[txn.type];
  const positive = txn.amount >= 0;
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
      <View style={tw`h-9 w-9 items-center justify-center rounded-md bg-mint-soft`}>
        <Icon name={m.icon} size={20} color="#0A6A46" />
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw`font-display text-[14px] font-extrabold text-ink-900`}>{m.label}</Text>
        <Text numberOfLines={1} style={tw`font-sans text-[12px] font-bold text-ink-400`}>
          {txn.note ? `${txn.note} · ` : ''}
          {relativeDate(txn.created_at)}
        </Text>
      </View>
      <View style={tw`flex-row items-center gap-1`}>
        <Text style={tw.style('font-number text-[14px] font-extrabold', positive ? 'text-mint-ink' : 'text-ink-700')}>
          {positive ? '+' : '−'}
        </Text>
        <CoinGlyph size={14} />
        <Text style={tw.style('font-number text-[14px] font-extrabold', positive ? 'text-mint-ink' : 'text-ink-700')}>
          {fmt(txn.amount)}
        </Text>
      </View>
    </View>
  );
}

export function InterestScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const [savings, setSavings] = useState(0);
  const [txns, setTxns] = useState<SavingsTransaction[] | null>(null);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    const [wallet, list] = await Promise.all([
      getKidWallet(client, profile.id),
      listSavingsTransactions(client, profile.id),
    ]);
    setSavings(wallet.data?.savings_balance ?? 0);
    setTxns(list.data ?? []);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!client || !profile) return;
    const unsub = subscribeToTable(client, {
      table: 'savings_transactions',
      filter: `kid_id=eq.${profile.id}`,
      onChange: () => void load(),
    });
    return () => unsub();
  }, [client, profile, load]);

  // A live example: this savings balance earns projectInterest(savings) next month.
  const example = Math.max(savings, 200);
  const earns = projectInterest(example, 0);

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <DetailHeader title="Interest" />
      {txns === null ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color="#16B97D" />
        </View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={tw.style('gap-2 px-5 pb-8', isRegular ? 'mx-auto w-full max-w-[640px]' : '')}
          ListHeaderComponent={
            <View style={tw`gap-3 pb-1`}>
              <View
                style={tw.style('gap-3 rounded-card bg-mint p-5', {
                  shadowColor: '#0E9E68',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                  elevation: 6,
                })}
              >
                <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-white opacity-90`}>
                  How interest works
                </Text>
                <Text style={tw`font-display text-[20px] font-extrabold leading-7 text-white`}>
                  Every month your savings grow by 5%. The more you keep saved, the more free loot you earn.
                </Text>
                <View style={tw`flex-row items-center gap-2 rounded-md bg-white/20 px-3 py-3`}>
                  <Icon name="lightbulb" size={20} color="#FFFFFF" />
                  <Text style={tw`font-display text-[14px] font-extrabold text-white`}>
                    Save {fmt(example)} → earn {fmt(earns)} next month
                  </Text>
                </View>
              </View>
              <Text style={tw`mt-1 font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
                Savings activity
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
              <Icon name="piggy-bank" size={40} color="#A39CAD" />
              <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
                No savings activity yet — move some loot to start growing it!
              </Text>
            </View>
          }
          renderItem={({ item }) => <Row txn={item} />}
        />
      )}
    </View>
  );
}
