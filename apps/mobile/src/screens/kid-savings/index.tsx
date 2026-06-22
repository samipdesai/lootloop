// Kid: Savings (#31 wallet vs savings) + transfer (#32) + interest (#35) + history
// (#33), rebuilt to the design canvas (15 · Savings): the Looty mascot over a mint
// "In savings" BalancePill, a next-month interest row, an inline Move-loot card
// (deposit/withdraw), and the savings ledger. Transfers go through
// transfer_to_savings (atomic, self-authed, overdraft-rejecting). (The canvas
// pushes Move loot / Interest to screens 16/17; kept inline until the kid stack.)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  transferToSavings,
  listSavingsTransactions,
  subscribeToTable,
  type SavingsTransaction,
} from '@lootloop/client';
import { projectInterest } from '@lootloop/domain';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon, type IconName } from '../../components/ui/Icon';
import { BalancePill, CoinBadge } from '../../components/ui/money';
import { Looty } from '../../components/ui/BrandMark';
import { Segmented } from '../../components/ui/Segmented';
import tw from '../../lib/tw';
import { relativeDate } from './format';

type Direction = 'deposit' | 'withdraw';
interface Balances {
  wallet: number;
  savings: number;
}
const fmt = (n: number) => n.toLocaleString('en-US');

// Next-month interest teaser (mint row, trending-up). projectInterest(savings, 0)
// = what THIS balance earns next month at the 5%/month teaching rate.
function InterestRow({ savings }: { savings: number }) {
  const next = projectInterest(savings, 0);
  return (
    <View style={tw`flex-row items-center justify-between rounded-lg bg-mint-soft px-4 py-3`}>
      <View style={tw`flex-row items-center gap-2`}>
        <Icon name="trending-up" size={20} color="#0A6A46" />
        <Text style={tw`font-sans text-[14px] font-extrabold text-mint-ink`}>Earns next month</Text>
      </View>
      <CoinBadge amount={next} size="sm" tone="plain" sign />
    </View>
  );
}

function TransferCard({
  balances,
  busy,
  error,
  onSubmit,
}: {
  balances: Balances;
  busy: boolean;
  error: string;
  onSubmit: (amount: number, direction: Direction) => void;
}) {
  const [direction, setDirection] = useState<Direction>('deposit');
  const [raw, setRaw] = useState('');
  const amount = Number.parseInt(raw, 10);
  const valid = Number.isInteger(amount) && amount > 0;
  const source = direction === 'deposit' ? balances.wallet : balances.savings;
  const overdraft = valid && amount > source;
  const canSubmit = valid && !overdraft && !busy;
  const localError = overdraft
    ? direction === 'deposit'
      ? `You only have 🪙 ${fmt(balances.wallet)} in your wallet.`
      : `You only have 🪙 ${fmt(balances.savings)} in savings.`
    : '';
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(amount, direction);
    setRaw('');
  };
  return (
    <View
      style={tw.style('gap-3 rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <Text style={tw`font-display text-[18px] font-extrabold text-ink-900`}>Move your loot</Text>
      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { key: 'deposit', label: 'Deposit ↓' },
          { key: 'withdraw', label: 'Withdraw ↑' },
        ]}
      />
      <Text style={tw`-mt-1 font-sans text-[12px] font-bold text-ink-400`}>
        {direction === 'deposit' ? 'Wallet → Savings' : 'Savings → Wallet'}
      </Text>
      <Input
        testID="savings-amount-input"
        label="Amount"
        keyboardType="number-pad"
        placeholder="0"
        value={raw}
        onChangeText={(t) => setRaw(t.replace(/[^0-9]/g, ''))}
        error={localError || error || undefined}
        editable={!busy}
      />
      <Button
        variant="mint"
        block
        loading={busy}
        disabled={!canSubmit}
        onPress={submit}
      >
        {direction === 'deposit' ? 'Deposit to savings' : 'Withdraw to wallet'}
      </Button>
    </View>
  );
}

const TYPE_META: Record<SavingsTransaction['type'], { label: string; icon: IconName }> = {
  deposit: { label: 'Deposit', icon: 'arrow-down' },
  withdraw: { label: 'Withdraw', icon: 'arrow-down' },
  interest: { label: 'Interest', icon: 'sparkles' },
};

function HistoryRow({ txn }: { txn: SavingsTransaction }) {
  const meta = TYPE_META[txn.type];
  const positive = txn.amount >= 0;
  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card px-4 py-3', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <View
        style={tw.style('h-10 w-10 items-center justify-center rounded-md', positive ? 'bg-mint-soft' : 'bg-ink-100')}
      >
        <Icon name={meta.icon} size={18} color={positive ? '#0A6A46' : '#756E80'} />
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw`font-display text-[15px] font-extrabold text-ink-900`}>{meta.label}</Text>
        <Text numberOfLines={1} style={tw`font-sans text-[12px] font-bold text-ink-400`}>
          {txn.note ? `${txn.note} · ` : ''}
          {relativeDate(txn.created_at)}
        </Text>
      </View>
      <Text
        style={tw.style('font-number text-[15px] font-extrabold', positive ? 'text-mint-ink' : 'text-ink-700')}
      >
        {positive ? '+' : '−'}🪙 {fmt(Math.abs(txn.amount))}
      </Text>
    </View>
  );
}

export function KidSavingsScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';

  const [balances, setBalances] = useState<Balances | null>(null);
  const [history, setHistory] = useState<SavingsTransaction[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferError, setTransferError] = useState('');

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setLoadError('');
    const [wallet, txns] = await Promise.all([
      getKidWallet(client, profile.id),
      listSavingsTransactions(client, profile.id),
    ]);
    if (wallet.error || !wallet.data || txns.error || !txns.data) {
      setLoadError("Couldn't load your savings. Pull to try again.");
      setBalances(null);
      setHistory([]);
      return;
    }
    setBalances({ wallet: wallet.data.wallet_balance, savings: wallet.data.savings_balance });
    setHistory(txns.data);
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
        table: 'savings_transactions',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

  const transfer = async (amount: number, direction: Direction) => {
    if (!client || !profile || busy) return;
    setBusy(true);
    setTransferError('');
    const { error } = await transferToSavings(client, profile.id, amount, direction);
    setBusy(false);
    if (error) {
      setTransferError("That didn't work — check the amount and try again.");
      return;
    }
    await load();
  };

  const header = useMemo(
    () => (
      <View style={tw`gap-3.5 pb-1`}>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Savings</Text>
        <View style={tw`items-center`}>
          <Looty size={76} />
        </View>
        <BalancePill amount={balances?.savings ?? 0} label="In savings" tone="mint" />
        {balances ? <InterestRow savings={balances.savings} /> : null}
        {balances ? (
          <TransferCard
            balances={balances}
            busy={busy}
            error={transferError}
            onSubmit={(a, d) => void transfer(a, d)}
          />
        ) : null}
        {loadError ? (
          <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
          </View>
        ) : null}
        <Text style={tw`mt-1 font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
          Savings activity
        </Text>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances, busy, transferError, loadError],
  );

  if (balances === null && history === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#16B97D" />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={history ?? []}
        keyExtractor={(txn) => txn.id}
        contentContainerStyle={tw.style(
          'gap-2.5 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
            <Icon name="piggy-bank" size={40} color="#A39CAD" />
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No savings activity yet — move some loot to get growing!
            </Text>
          </View>
        }
        renderItem={({ item }) => <HistoryRow txn={item} />}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
