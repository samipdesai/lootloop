// Kid: Confirm purchase (canvas 12). Pushed from the Store when a reward is
// tapped. Shows the reward, a cost → wallet → after breakdown, and Buy / Not now.
// Buy runs purchase_reward (atomic, self-authed), celebrates, then returns.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getKidWallet, purchaseReward } from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav, useShellParams } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { Celebration } from '../kid-store/Celebration';
import { DetailHeader } from './DetailHeader';

interface PurchaseParams {
  rewardId: string;
  title: string;
  cost: number;
  emoji: string | null;
}

function BreakdownRow({ label, amount, strong, tone }: { label: string; amount: number; strong?: boolean; tone?: 'soft' | 'plain' }) {
  return (
    <View style={tw`flex-row items-center justify-between`}>
      <Text style={tw.style('font-sans text-[14px]', strong ? 'font-extrabold text-ink-900' : 'font-bold text-ink-500')}>
        {label}
      </Text>
      <CoinBadge amount={amount} size="sm" tone={tone ?? 'plain'} />
    </View>
  );
}

export function ConfirmPurchaseScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const nav = useShellNav();
  const reward = useShellParams() as unknown as PurchaseParams | undefined;
  const [wallet, setWallet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(0);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    const { data } = await getKidWallet(client, profile.id);
    if (data) setWallet(data.wallet_balance);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!reward) {
    return (
      <View style={tw`flex-1 bg-surface-page`}>
        <DetailHeader title="Buy reward" />
      </View>
    );
  }

  const buy = async () => {
    if (!client || !profile || busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await purchaseReward(client, reward.rewardId, profile.id);
    if (err) {
      setBusy(false);
      setError("Couldn't buy that — try again.");
      return;
    }
    setCelebrate((t) => t + 1); // onDone → goBack
  };

  const after = wallet != null ? wallet - reward.cost : null;

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <DetailHeader />
      <View style={tw.style('flex-1 justify-center px-5 pb-8', isRegular ? 'mx-auto w-full max-w-[480px]' : '')}>
        <View style={tw`items-center gap-2`}>
          <View style={tw`h-24 w-24 items-center justify-center rounded-2xl bg-indigo-soft`}>
            <Text style={tw`text-[52px]`}>{reward.emoji ?? '🎁'}</Text>
          </View>
          <Text style={tw`text-center font-display text-[24px] font-extrabold text-ink-900`}>{reward.title}</Text>
          <Text style={tw`font-sans text-[15px] font-bold text-ink-500`}>Buy this reward?</Text>
        </View>

        <View style={tw`mt-5 gap-2.5 rounded-card bg-ink-50 p-4`}>
          <BreakdownRow label="Cost" amount={reward.cost} tone="soft" />
          {wallet != null ? <BreakdownRow label="Your wallet now" amount={wallet} /> : null}
          <View style={tw`h-px bg-ink-100`} />
          {after != null ? <BreakdownRow label="After buying" amount={Math.max(after, 0)} strong /> : null}
        </View>

        {error ? (
          <View style={tw`mt-3 rounded-md bg-danger-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
          </View>
        ) : null}

        <View style={tw`mt-5 gap-2.5`}>
          <Button testID="confirm-buy" block size="lg" loading={busy} disabled={busy} onPress={() => void buy()}>
            Buy it
          </Button>
          <Button variant="ghost" block size="lg" disabled={busy} onPress={() => nav.goBack()}>
            Not now
          </Button>
        </View>
      </View>
      {celebrate > 0 ? <Celebration token={celebrate} onDone={() => nav.goBack()} /> : null}
    </View>
  );
}
