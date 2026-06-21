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
  listPointTransactions,
  type PointTransaction,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import tw from '../../lib/tw';
import { ledgerRow, relativeDate } from './ledger';

// Keep the home view snappy — the ledger is "recent activity", not the full
// history. The full ledger lives behind a dedicated screen later if needed.
const RECENT_LIMIT = 20;

const fmt = (n: number) => n.toLocaleString('en-US');

interface DashboardData {
  walletBalance: number;
  savingsBalance: number;
  txns: PointTransaction[];
}

function CoinNumber({ value, big }: { value: number; big: boolean }) {
  return (
    <View style={tw`flex-row items-center gap-2`}>
      <Text style={tw.style('text-[28px]', big ? 'text-[34px]' : '')}>🪙</Text>
      <Text
        style={tw.style(
          'font-display font-extrabold text-white',
          big ? 'text-[44px]' : 'text-[18px]',
        )}
      >
        {fmt(value)}
      </Text>
    </View>
  );
}

function WalletHero({
  walletBalance,
  savingsBalance,
}: {
  walletBalance: number;
  savingsBalance: number;
}) {
  return (
    <View style={tw`gap-3`}>
      <View
        style={tw.style('gap-1 rounded-card bg-orange px-6 py-5', {
          shadowColor: '#D85F06',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        })}
      >
        <Text
          style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-white opacity-90`}
        >
          Wallet
        </Text>
        <CoinNumber value={walletBalance} big />
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!client || !profile) return;
    setError('');
    const [walletRes, txnRes] = await Promise.all([
      getKidWallet(client, profile.id),
      listPointTransactions(client, profile.id),
    ]);
    if (walletRes.error || txnRes.error) {
      setError("Couldn't load your loot. Pull to try again.");
      setData({ walletBalance: 0, savingsBalance: 0, txns: [] });
      return;
    }
    setData({
      walletBalance: walletRes.data?.wallet_balance ?? 0,
      savingsBalance: walletRes.data?.savings_balance ?? 0,
      txns: (txnRes.data ?? []).slice(0, RECENT_LIMIT),
    });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

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
        keyExtractor={(t) => t.id}
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
            />
            <Text style={tw`mt-1 font-display text-[19px] font-extrabold text-ink-900`}>
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
