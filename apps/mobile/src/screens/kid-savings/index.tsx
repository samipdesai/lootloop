// Kid: Savings (#31 wallet vs savings) + transfer (#32 deposit/withdraw) +
// interest projection (#35) + history (#33). The kid sees a prominent savings
// "piggy bank" balance alongside their spendable wallet, a friendly next-month
// interest teaser (projectInterest from @lootloop/domain, the 5%/month rate that
// the credit_interest cron pays), a deposit/withdraw control, and their savings
// ledger newest-first. Transfers go through transfer_to_savings (atomic, self-
// authed, overdraft-rejecting) — we pre-validate against the relevant balance
// AND surface the SQL function's error inline, since it's the source of truth.
// Mirrors MyChoresScreen / KidStoreScreen: useKidSession loads, FlatList states,
// busy-locked actions, pull-to-refresh, adaptive useSizeClass(), twrnc styling.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  transferToSavings,
  listSavingsTransactions,
  type SavingsTransaction,
} from '@lootloop/client';
import { projectInterest } from '@lootloop/domain';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import tw from '../../lib/tw';
import { relativeDate } from './format';

type Direction = 'deposit' | 'withdraw';

interface Balances {
  wallet: number;
  savings: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');

// --- Balances: savings hero (piggy bank) + spendable wallet beside it. --------

function BalancesHeader({ balances }: { balances: Balances | null }) {
  return (
    <View style={tw`flex-row gap-3`}>
      {/* Savings — the prominent "piggy bank" pill. */}
      <View
        style={tw.style('flex-[1.4] gap-1 rounded-card bg-mint px-5 py-4', {
          shadowColor: '#0E9E68',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        })}
      >
        <Text style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-white`}>
          🐷 Savings
        </Text>
        <Text style={tw`font-display text-[30px] font-extrabold text-white`}>
          🪙 {balances == null ? '—' : fmt(balances.savings)}
        </Text>
      </View>
      {/* Wallet — spendable, quieter. */}
      <View style={tw`flex-1 justify-center gap-1 rounded-card bg-surface-card px-4 py-4`}>
        <Text style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-ink-400`}>
          Wallet
        </Text>
        <Text style={tw`font-display text-[22px] font-extrabold text-ink-800`}>
          🪙 {balances == null ? '—' : fmt(balances.wallet)}
        </Text>
      </View>
    </View>
  );
}

// --- Interest projection (#35): friendly next-month earn teaser. --------------

function InterestTeaser({ savings }: { savings: number }) {
  // projectInterest(currentSavings, additionalAmount) — 0 extra = what THIS
  // balance earns next month at the teaching rate.
  const next = projectInterest(savings, 0);
  return (
    <View style={tw`flex-row items-center gap-2.5 rounded-card bg-mint-soft px-4 py-3`}>
      <Text style={tw`text-[22px]`}>✨</Text>
      <Text style={tw`flex-1 font-sans text-[13px] font-bold leading-[18px] text-mint-ink`}>
        {savings > 0 ? (
          <>
            Save and grow! Next month you&apos;ll earn about{' '}
            <Text style={tw`font-display font-extrabold`}>🪙 {fmt(next)}</Text> in interest — free
            loot, just for waiting!
          </>
        ) : (
          'Move some loot to savings and earn free interest every month — just for waiting!'
        )}
      </Text>
    </View>
  );
}

// --- Transfer control (#32): pick direction + amount → transfer_to_savings. ---

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
  // The balance the move draws from: deposit pulls from wallet, withdraw from savings.
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
    <View style={tw`gap-3 rounded-card bg-surface-card p-4`}>
      <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>Move your loot</Text>

      {/* Direction toggle. */}
      <View style={tw`flex-row gap-2`}>
        {(['deposit', 'withdraw'] as const).map((d) => {
          const active = direction === d;
          return (
            <Text
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setDirection(d)}
              style={tw.style(
                'flex-1 overflow-hidden rounded-pill py-2.5 text-center font-display text-[14px] font-extrabold',
                active ? 'bg-mint text-white' : 'bg-ink-100 text-ink-500',
              )}
            >
              {d === 'deposit' ? 'Deposit ↓' : 'Withdraw ↑'}
            </Text>
          );
        })}
      </View>
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

      <Button block loading={busy} disabled={!canSubmit} onPress={submit}>
        {direction === 'deposit' ? 'Deposit to savings' : 'Withdraw to wallet'}
      </Button>
    </View>
  );
}

// --- History row (#33): type label, signed amount, note, relative date. -------

const TYPE_META: Record<SavingsTransaction['type'], { label: string; emoji: string }> = {
  deposit: { label: 'Deposit', emoji: '↓' },
  withdraw: { label: 'Withdraw', emoji: '↑' },
  interest: { label: 'Interest', emoji: '✨' },
};

function HistoryRow({ txn }: { txn: SavingsTransaction }) {
  const meta = TYPE_META[txn.type];
  // amount is signed relative to the savings balance: deposits/interest add
  // (mint, +), withdrawals subtract (ink, −).
  const positive = txn.amount >= 0;
  return (
    <View style={tw`flex-row items-center gap-3 rounded-xl bg-surface-card px-4 py-3`}>
      <View
        style={tw.style(
          'h-10 w-10 items-center justify-center rounded-lg',
          positive ? 'bg-mint-soft' : 'bg-ink-100',
        )}
      >
        <Text style={tw`text-[18px]`}>{meta.emoji}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw`font-display text-[15px] font-extrabold text-ink-900`}>{meta.label}</Text>
        <Text numberOfLines={1} style={tw`font-sans text-[12px] font-bold text-ink-400`}>
          {txn.note ? `${txn.note} · ` : ''}
          {relativeDate(txn.created_at)}
        </Text>
      </View>
      <Text
        style={tw.style(
          'font-number text-[15px] font-extrabold',
          positive ? 'text-mint-ink' : 'text-ink-700',
        )}
      >
        {positive ? '+' : '−'}🪙 {fmt(Math.abs(txn.amount))}
      </Text>
    </View>
  );
}

// --- Screen -------------------------------------------------------------------

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
    setBalances({
      wallet: wallet.data.wallet_balance,
      savings: wallet.data.savings_balance,
    });
    setHistory(txns.data);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const transfer = async (amount: number, direction: Direction) => {
    if (!client || !profile || busy) return;
    setBusy(true);
    setTransferError('');
    const { error } = await transferToSavings(client, profile.id, amount, direction);
    setBusy(false);
    if (error) {
      // The SQL fn is the source of truth (e.g. a race that overdraws).
      setTransferError("That didn't work — check the amount and try again.");
      return;
    }
    await load();
  };

  const header = useMemo(
    () => (
      <View style={tw`gap-3 pb-1`}>
        <BalancesHeader balances={balances} />
        {balances ? <InterestTeaser savings={balances.savings} /> : null}
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
        <Text style={tw`mt-1 font-display text-[17px] font-extrabold text-ink-900`}>Recent</Text>
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
        keyExtractor={(t) => t.id}
        contentContainerStyle={tw.style(
          'gap-2 px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
            <Text style={tw`text-[40px]`}>🐷</Text>
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
