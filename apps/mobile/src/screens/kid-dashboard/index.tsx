// Kid Dashboard — the kid's home (#19 wallet balance + #20 own point history).
// A prominent wallet-balance hero (the spendable loot total) with a smaller
// savings chip, over the kid's recent points ledger (Earned / Bonus / Spent /
// Refund, signed + colored). Reads everything through the kid-session client so
// RLS scopes it to the signed-in kid. Mirrors MyChoresScreen's load / loading /
// empty / error / pull-to-refresh shape; one component tree, adaptive on size
// class (iPhone single column → iPad centered, wider). Slots under KidShell's
// greeting header.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import {
  getKidWallet,
  listKidScheduleItems,
  listPointTransactions,
  subscribeToTable,
  type PointTransaction,
  type ScheduleItem,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useAgeModeTheme, type AgeModeTheme } from '../../theme/ageMode';
import tw from '../../lib/tw';
import { ledgerRow, relativeDate } from './ledger';
import { formatTime, todaysItems } from './timeline';

// Keep the home view snappy — the ledger is "recent activity", not the full
// history. The full ledger lives behind a dedicated screen later if needed.
const RECENT_LIMIT = 20;

const fmt = (n: number) => n.toLocaleString('en-US');

interface DashboardData {
  walletBalance: number;
  savingsBalance: number;
  txns: PointTransaction[];
  schedule: ScheduleItem[]; // already filtered to today + ordered by start_time
}

function CoinNumber({
  value,
  numberSize,
  iconSize,
}: {
  value: number;
  numberSize: number;
  iconSize: number;
}) {
  return (
    <View style={tw`flex-row items-center gap-2`}>
      <Text style={{ fontSize: iconSize }}>🪙</Text>
      <Text style={tw.style('font-display font-extrabold text-white', { fontSize: numberSize })}>
        {fmt(value)}
      </Text>
    </View>
  );
}

function WalletHero({
  walletBalance,
  savingsBalance,
  theme,
}: {
  walletBalance: number;
  savingsBalance: number;
  theme: AgeModeTheme;
}) {
  // Age-mode: the hero loot number scales with the band (huge for Simple, compact
  // for Teen) — the most visible age signal on the kid's home.
  return (
    <View style={tw`gap-3`}>
      <View
        style={tw.style(`gap-1 rounded-${theme.cardRadius} bg-orange px-6 py-5`, {
          shadowColor: '#D85F06',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        })}
      >
        <Text
          style={tw.style(
            // font-size stays in the class (not a style object) so twrnc can derive
            // the relative `tracking-wide` letter-spacing from it.
            `font-sans font-extrabold uppercase tracking-wide text-[${theme.captionSize}px] text-white opacity-90`,
          )}
        >
          Wallet
        </Text>
        <CoinNumber
          value={walletBalance}
          numberSize={theme.titleSize + 16}
          iconSize={theme.titleSize}
        />
      </View>

      <View
        style={tw`flex-row items-center justify-between rounded-card bg-mint-soft px-5 py-4`}
      >
        <View style={tw`flex-row items-center gap-2`}>
          <Text style={tw`text-[20px]`}>🐷</Text>
          <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-mint-ink`}>
            Savings
          </Text>
        </View>
        <Text style={tw`font-display text-[18px] font-extrabold text-mint-ink`}>
          🪙 {fmt(savingsBalance)}
        </Text>
      </View>
    </View>
  );
}

// One row of the "Today's schedule" timeline: a left time column, a connector
// line + dot, then the item's icon, title and (optional) end time. `first`/`last`
// trim the connector so the line doesn't poke past the top/bottom rows.
function TimelineRow({
  item,
  first,
  last,
}: {
  item: ScheduleItem;
  first: boolean;
  last: boolean;
}) {
  return (
    <View style={tw`flex-row gap-3`}>
      <View style={tw`w-16 pt-3 items-end`}>
        <Text style={tw`font-display text-[13px] font-extrabold text-indigo-strong`}>
          {formatTime(item.start_time)}
        </Text>
      </View>
      <View style={tw`w-6 items-center`}>
        <View style={tw.style('w-0.5 flex-1', first ? '' : 'bg-indigo-soft')} />
        <View style={tw`h-3 w-3 rounded-full bg-indigo-strong`} />
        <View style={tw.style('w-0.5 flex-1', last ? '' : 'bg-indigo-soft')} />
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <View style={tw`flex-row items-center gap-3 rounded-xl bg-surface-card px-4 py-3.5`}>
          <View style={tw`h-11 w-11 items-center justify-center rounded-lg bg-indigo-soft`}>
            <Text style={tw`text-[20px]`}>{item.icon || '⏰'}</Text>
          </View>
          <View style={tw`min-w-0 flex-1`}>
            <Text
              numberOfLines={1}
              style={tw`font-display text-[15px] font-extrabold text-ink-900`}
            >
              {item.title}
            </Text>
            {item.end_time ? (
              <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>
                until {formatTime(item.end_time)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function TodaysSchedule({ items, headingSize }: { items: ScheduleItem[]; headingSize: number }) {
  return (
    <View style={tw`gap-3`}>
      <Text
        style={tw.style('mt-1 font-display font-extrabold text-ink-900', { fontSize: headingSize })}
      >
        Today&apos;s schedule
      </Text>
      {items.length === 0 ? (
        <View style={tw`items-center gap-2 rounded-xl bg-surface-card px-6 py-8`}>
          <Text style={tw`text-[34px]`}>🎉</Text>
          <Text style={tw`text-center font-display text-[15px] font-extrabold text-ink-800`}>
            Nothing scheduled today 🎉
          </Text>
        </View>
      ) : (
        <View>
          {items.map((item, i) => (
            <TimelineRow
              key={item.id}
              item={item}
              first={i === 0}
              last={i === items.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ActivityRow({ txn }: { txn: PointTransaction }) {
  const row = ledgerRow(txn);
  const positive = row.tone === 'positive';
  return (
    <View style={tw`flex-row items-center gap-3 rounded-xl bg-surface-card px-4 py-3.5`}>
      <View
        style={tw.style(
          'h-11 w-11 items-center justify-center rounded-lg',
          positive ? 'bg-mint-soft' : 'bg-danger-soft',
        )}
      >
        <Text style={tw`text-[20px]`}>{row.emoji}</Text>
      </View>
      <View style={tw`min-w-0 flex-1`}>
        <Text numberOfLines={1} style={tw`font-display text-[15px] font-extrabold text-ink-900`}>
          {row.label}
        </Text>
        {txn.note ? (
          <Text numberOfLines={1} style={tw`font-sans text-[13px] font-bold text-ink-400`}>
            {txn.note}
          </Text>
        ) : (
          <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>
            {relativeDate(txn.created_at)}
          </Text>
        )}
      </View>
      <Text
        style={tw.style(
          'font-display text-[16px] font-extrabold',
          positive ? 'text-mint-ink' : 'text-danger-ink',
        )}
      >
        {row.amountText}
      </Text>
    </View>
  );
}

export function KidDashboardScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const t = useAgeModeTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const [walletRes, txnRes, scheduleRes] = await Promise.all([
      getKidWallet(client, profile.id),
      listPointTransactions(client, profile.id),
      listKidScheduleItems(client, profile.id),
    ]);
    if (walletRes.error || txnRes.error || scheduleRes.error) {
      setError("Couldn't load your loot. Pull to try again.");
      setData({ walletBalance: 0, savingsBalance: 0, txns: [], schedule: [] });
      return;
    }
    setData({
      walletBalance: walletRes.data?.wallet_balance ?? 0,
      savingsBalance: walletRes.data?.savings_balance ?? 0,
      txns: (txnRes.data ?? []).slice(0, RECENT_LIMIT),
      schedule: todaysItems(scheduleRes.data ?? []),
    });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (#41): the kid's wallet + ledger update live when a parent approves
  // a chore / awards points / a purchase clears — no manual refresh. The kid
  // client is already realtime-authed (createKidClient).
  useEffect(() => {
    if (!client || !profile) return;
    const unsubs = [
      subscribeToTable(client, {
        table: 'point_transactions',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
      subscribeToTable(client, {
        table: 'wallets',
        filter: `kid_id=eq.${profile.id}`,
        onChange: () => void load(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [client, profile, load]);

  if (!client || !profile || data === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#F4720E" />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <FlatList
        data={data.txns}
        keyExtractor={(txn) => txn.id}
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
            <WalletHero
              walletBalance={data.walletBalance}
              savingsBalance={data.savingsBalance}
              theme={t}
            />
            <TodaysSchedule items={data.schedule} headingSize={t.headingSize} />
            <Text
              style={tw.style('mt-1 font-display font-extrabold text-ink-900', {
                fontSize: t.headingSize,
              })}
            >
              Recent activity
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={tw`mt-2 items-center gap-2 rounded-xl bg-surface-card px-6 py-12`}>
            <Text style={tw`text-[40px]`}>🪙</Text>
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No points yet — do a chore to start earning!
            </Text>
          </View>
        }
        renderItem={({ item }) => <ActivityRow txn={item} />}
        refreshing={false}
        onRefresh={() => void load()}
      />
    </View>
  );
}
