// Per-kid point history, parent view (#20). Shows the kid's current wallet
// balance header + their points ledger (earn / bonus / spend / refund) newest
// first. Reads are SELECT-only (RLS 002 scopes them to the family). Loading /
// empty / error states are all rendered here so the surface is never blank. One
// component tree; the regular (iPad) size class centres + widens the column.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getKidWallet,
  listPointTransactions,
  type KidProfile,
  type PointTransaction,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';

interface PointHistoryProps {
  kid: KidProfile;
  onBack: () => void;
}

// Human label per ledger type. earn/refund/bonus credit the wallet; spend debits.
const TYPE_LABEL: Record<PointTransaction['type'], string> = {
  earn: 'Earned',
  bonus: 'Bonus',
  spend: 'Spent',
  refund: 'Refund',
};

// Relative date for the ledger row — short, parent-glanceable.
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const day = 86_400_000;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CancelLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onPress}>
      <Text style={tw`font-sans text-[15px] font-bold text-ink-500`}>Back</Text>
    </Pressable>
  );
}

function LedgerRow({ txn }: { txn: PointTransaction }) {
  // amount is signed in the column; positive = credit (mint), negative = debit
  // (danger). Format with an explicit sign for at-a-glance scanning.
  const credit = txn.amount >= 0;
  const sign = credit ? '+' : '−';
  const magnitude = Math.abs(txn.amount);

  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      <View style={tw`flex-1`}>
        <Text style={tw`font-display text-[15px] font-extrabold text-ink-900`}>
          {TYPE_LABEL[txn.type]}
        </Text>
        {txn.note ? (
          <Text style={tw`mt-0.5 font-sans text-[13px] font-semibold text-ink-500`}>
            {txn.note}
          </Text>
        ) : null}
        <Text style={tw`mt-0.5 font-sans text-[12px] font-semibold text-ink-400`}>
          {relativeDate(txn.created_at)}
        </Text>
      </View>
      <Text
        style={tw.style(
          'font-display text-[16px] font-extrabold',
          credit ? 'text-mint-strong' : 'text-danger-ink',
        )}
      >
        {sign}
        {magnitude}
      </Text>
    </View>
  );
}

export function PointHistory({ kid, onBack }: PointHistoryProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();

  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [walletRes, txnRes] = await Promise.all([
      getKidWallet(supabase, kid.id),
      listPointTransactions(supabase, kid.id),
    ]);
    setLoading(false);
    if (walletRes.error || txnRes.error) {
      setLoadError("Couldn't load the history. Try again.");
      return;
    }
    setBalance(walletRes.data?.wallet_balance ?? 0);
    setTxns(txnRes.data ?? []);
  }, [kid.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const containerStyle = tw.style(
    'gap-3 px-5 pb-10 pt-4',
    isRegular ? 'mx-auto w-full max-w-[720px]' : null,
  );

  const header = (
    <View style={tw.style('mb-1 gap-4', { paddingTop: insets.top + 8 })}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-display text-[28px] font-extrabold text-ink-900`}>History</Text>
        <CancelLink onPress={onBack} />
      </View>
      <View style={tw`rounded-card bg-coin-soft p-4`}>
        <Text style={tw`font-sans text-[13px] font-bold text-coin-ink`}>
          {kid.display_name}’s balance
        </Text>
        <Text style={tw`mt-0.5 font-display text-[28px] font-extrabold text-coin-ink`}>
          {balance ?? 0} pts
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={tw.style('flex-1 bg-surface-page px-5', { paddingTop: insets.top + 8 })}>
        <View style={tw`flex-row items-center justify-between`}>
          <Text style={tw`font-display text-[28px] font-extrabold text-ink-900`}>History</Text>
          <CancelLink onPress={onBack} />
        </View>
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#F4720E" />
          <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>
            Loading history…
          </Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View
        style={tw.style('flex-1 items-center justify-center bg-surface-page px-8', {
          paddingTop: insets.top,
        })}
      >
        <View style={tw`w-full max-w-[420px] gap-4`}>
          <FormError message={loadError} />
          <Button block onPress={() => void load()}>
            Try again
          </Button>
          <Button block variant="ghost" onPress={onBack}>
            Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={txns}
      keyExtractor={(t) => t.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={containerStyle}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={tw`items-center px-4 py-12`}>
          <Text style={tw`text-[40px]`}>🧾</Text>
          <Text style={tw`mt-3 text-center font-display text-[18px] font-extrabold text-ink-900`}>
            No activity yet
          </Text>
          <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
            Earned, bonus, and spent points will show up here.
          </Text>
        </View>
      }
      renderItem={({ item }) => <LedgerRow txn={item} />}
    />
  );
}
