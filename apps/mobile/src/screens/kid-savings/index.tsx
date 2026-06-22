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
  subscribeToTable,
  type SavingsTransaction,
} from '@lootloop/client';
import { projectInterest } from '@lootloop/domain';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useAgeModeTheme, type AgeModeTheme } from '../../theme/ageMode';
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

function BalancesHeader({ balances, theme }: { balances: Balances | null; theme: AgeModeTheme }) {
  // Age-mode: the savings hero is the loudest age signal here — big & playful for
  // Simple (with a giant 🐷), compact & understated for Teen. The savings number
  // scales off titleSize; the wallet (quieter) off headingSize.
  const playful = theme.gamification === 'high';
  return (
    <View style={tw`flex-row gap-3`}>
      {/* Savings — the prominent "piggy bank" pill. */}
      <View
        style={tw.style(`flex-[1.4] gap-1 rounded-${theme.cardRadius} bg-mint px-5 py-4`, {
          shadowColor: '#0E9E68',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        })}
      >
        <Text
          // font-size stays in the class so twrnc can derive `tracking-wide` from it.
          style={tw.style(
            `font-sans font-extrabold uppercase tracking-wide text-[${theme.captionSize}px] text-white`,
          )}
        >
          🐷 Savings
        </Text>
        <Text
          style={tw.style('font-display font-extrabold text-white', { fontSize: theme.titleSize })}
        >
          🪙 {balances == null ? '—' : fmt(balances.savings)}
        </Text>
        {playful && balances != null ? (
          <Text style={{ fontSize: Math.round(28 * theme.iconScale) }}>🐷</Text>
        ) : null}
      </View>
      {/* Wallet — spendable, quieter. */}
      <View
        style={tw.style(
          `flex-1 justify-center gap-1 rounded-${theme.cardRadius} bg-surface-card px-4 py-4`,
        )}
      >
        <Text
          // font-size stays in the class so twrnc can derive `tracking-wide` from it.
          style={tw.style(
            `font-sans font-extrabold uppercase tracking-wide text-[${theme.captionSize}px] text-ink-400`,
          )}
        >
          Wallet
        </Text>
        <Text
          style={tw.style('font-display font-extrabold text-ink-800', {
            fontSize: theme.headingSize + 4,
          })}
        >
          🪙 {balances == null ? '—' : fmt(balances.wallet)}
        </Text>
      </View>
    </View>
  );
}

// --- Interest projection (#35): friendly next-month earn teaser. --------------

function InterestTeaser({ savings, theme }: { savings: number; theme: AgeModeTheme }) {
  // projectInterest(currentSavings, additionalAmount) — 0 extra = what THIS
  // balance earns next month at the teaching rate.
  const next = projectInterest(savings, 0);
  // Age-mode: the teaser text scales with the band, and the framing shifts —
  // Simple gets the excited "free loot!" pitch, Teen a plain interest-rate note.
  const understated = theme.gamification === 'low';
  return (
    <View
      style={tw.style(
        `flex-row items-center gap-2.5 rounded-${theme.cardRadius} bg-mint-soft px-4 py-3`,
      )}
    >
      <Text style={{ fontSize: Math.round(22 * theme.iconScale) }}>{understated ? '📈' : '✨'}</Text>
      <Text
        style={tw.style('flex-1 font-sans font-bold text-mint-ink', {
          fontSize: theme.bodySize - 2,
          lineHeight: theme.bodySize + 3,
        })}
      >
        {savings > 0 ? (
          understated ? (
            <>
              At 5%/month, this balance earns about{' '}
              <Text style={tw`font-display font-extrabold`}>🪙 {fmt(next)}</Text> next month.
            </>
          ) : (
            <>
              Save and grow! Next month you&apos;ll earn about{' '}
              <Text style={tw`font-display font-extrabold`}>🪙 {fmt(next)}</Text> in interest — free
              loot, just for waiting!
            </>
          )
        ) : understated ? (
          'Savings earns 5% interest each month — move some loot to start growing it.'
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
  theme,
  onSubmit,
}: {
  balances: Balances;
  busy: boolean;
  error: string;
  theme: AgeModeTheme;
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
    <View style={tw.style(`gap-3 rounded-${theme.cardRadius} bg-surface-card p-4`)}>
      <Text
        style={tw.style('font-display font-extrabold text-ink-900', { fontSize: theme.headingSize })}
      >
        Move your loot
      </Text>

      {/* Direction toggle — age-mode: the tappable pills meet the band's touch target. */}
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
                'flex-1 overflow-hidden rounded-pill text-center font-display font-extrabold',
                active ? 'bg-mint text-white' : 'bg-ink-100 text-ink-500',
                { fontSize: theme.bodySize - 1, lineHeight: theme.touchTarget - 16, height: theme.touchTarget - 16 },
              )}
            >
              {d === 'deposit' ? 'Deposit ↓' : 'Withdraw ↑'}
            </Text>
          );
        })}
      </View>
      <Text
        style={tw.style('-mt-1 font-sans font-bold text-ink-400', { fontSize: theme.captionSize })}
      >
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

function HistoryRow({ txn, theme }: { txn: SavingsTransaction; theme: AgeModeTheme }) {
  const meta = TYPE_META[txn.type];
  // amount is signed relative to the savings balance: deposits/interest add
  // (mint, +), withdrawals subtract (ink, −).
  const positive = txn.amount >= 0;
  // Age-mode: scale the icon tile/emoji and row type with the band, give the row
  // the band's min height + card radius.
  const tileSize = Math.round(40 * theme.iconScale);
  const emojiSize = Math.round(18 * theme.iconScale);
  return (
    <View
      style={tw.style(`flex-row items-center gap-3 rounded-${theme.cardRadius} bg-surface-card px-4 py-3`, {
        minHeight: theme.touchTarget,
      })}
    >
      <View
        style={tw.style('items-center justify-center rounded-lg', positive ? 'bg-mint-soft' : 'bg-ink-100', {
          width: tileSize,
          height: tileSize,
        })}
      >
        <Text style={{ fontSize: emojiSize }}>{meta.emoji}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw.style('font-display font-extrabold text-ink-900', { fontSize: theme.bodySize })}>
          {meta.label}
        </Text>
        <Text
          numberOfLines={1}
          style={tw.style('font-sans font-bold text-ink-400', { fontSize: theme.captionSize })}
        >
          {txn.note ? `${txn.note} · ` : ''}
          {relativeDate(txn.created_at)}
        </Text>
      </View>
      <Text
        style={tw.style('font-number font-extrabold', positive ? 'text-mint-ink' : 'text-ink-700', {
          fontSize: theme.bodySize,
        })}
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
  const t = useAgeModeTheme();

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

  // Realtime (#41): the kid's balances + savings ledger update live — when the
  // monthly credit_interest cron posts interest, or a parent award lands, the
  // wallet/savings totals and a new history row appear without a manual refresh.
  // The kid client is already realtime-authed (createKidClient).
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
      // The SQL fn is the source of truth (e.g. a race that overdraws).
      setTransferError("That didn't work — check the amount and try again.");
      return;
    }
    await load();
  };

  const header = useMemo(
    () => (
      <View style={tw.style('pb-1', { gap: t.gap })}>
        <BalancesHeader balances={balances} theme={t} />
        {balances ? <InterestTeaser savings={balances.savings} theme={t} /> : null}
        {balances ? (
          <TransferCard
            balances={balances}
            busy={busy}
            error={transferError}
            theme={t}
            onSubmit={(a, d) => void transfer(a, d)}
          />
        ) : null}
        {loadError ? (
          <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
          </View>
        ) : null}
        <Text
          style={tw.style('mt-1 font-display font-extrabold text-ink-900', {
            fontSize: t.headingSize,
          })}
        >
          Recent
        </Text>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances, busy, transferError, loadError, t],
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
          'px-4 py-4',
          isRegular ? 'mx-auto w-full max-w-[640px]' : '',
          { gap: t.gap - 4 },
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View
            style={tw.style(`items-center gap-2 rounded-${t.cardRadius} bg-surface-card px-6 py-10`)}
          >
            <Text style={{ fontSize: Math.round(40 * t.iconScale) }}>
              {t.gamification === 'low' ? '🏦' : '🐷'}
            </Text>
            <Text
              style={tw.style('text-center font-display font-extrabold text-ink-800', {
                fontSize: t.headingSize,
              })}
            >
              {t.gamification === 'low'
                ? 'No savings activity yet — transfer loot to start earning interest.'
                : 'No savings activity yet — move some loot to get growing!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <HistoryRow txn={item} theme={t} />}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
