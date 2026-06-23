// Kid: Move loot (canvas 16). Pushed from Savings. Deposit wallet→savings or
// withdraw savings→wallet (atomic transfer_to_savings, overdraft-rejected), then
// return to Savings.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { getKidWallet, transferToSavings } from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Segmented } from '../../components/ui/Segmented';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { DetailHeader } from './DetailHeader';

type Direction = 'deposit' | 'withdraw';
const fmt = (n: number) => n.toLocaleString('en-US');

export function MoveLootScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const nav = useShellNav();
  const [balances, setBalances] = useState<{ wallet: number; savings: number } | null>(null);
  const [direction, setDirection] = useState<Direction>('deposit');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!client || !profile) return;
    const { data } = await getKidWallet(client, profile.id);
    if (data) setBalances({ wallet: data.wallet_balance, savings: data.savings_balance });
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const amount = Number.parseInt(raw, 10);
  const valid = Number.isInteger(amount) && amount > 0;
  const source = direction === 'deposit' ? balances?.wallet ?? 0 : balances?.savings ?? 0;
  const overdraft = valid && amount > source;
  const canSubmit = valid && !overdraft && !busy && !!balances;
  const overdraftMsg = overdraft
    ? direction === 'deposit'
      ? `You only have ${fmt(balances?.wallet ?? 0)} in your wallet.`
      : `You only have ${fmt(balances?.savings ?? 0)} in savings.`
    : '';

  const submit = async () => {
    if (!client || !profile || !canSubmit) return;
    setBusy(true);
    setError('');
    const { error: err } = await transferToSavings(client, profile.id, amount, direction);
    setBusy(false);
    if (err) {
      setError("That didn't work — check the amount and try again.");
      return;
    }
    nav.goBack();
  };

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-surface-page`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DetailHeader title="Move loot" />
      {balances === null ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color="#16B97D" />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={tw.style('gap-4 px-5 pb-8 pt-2', isRegular ? 'mx-auto w-full max-w-[480px]' : '')}
        >
          {/* Wallet ↔ savings balances */}
          <View style={tw`flex-row gap-3`}>
            <View style={tw`flex-1 items-center gap-1.5 rounded-card bg-surface-card px-3 py-4`}>
              <Text style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-[12px] text-ink-400`}>Wallet</Text>
              <CoinBadge amount={balances.wallet} size="sm" tone="soft" />
            </View>
            <View style={tw`flex-1 items-center gap-1.5 rounded-card bg-surface-card px-3 py-4`}>
              <Text style={tw`font-sans text-[12px] font-extrabold uppercase tracking-wide text-[12px] text-ink-400`}>Savings</Text>
              <CoinBadge amount={balances.savings} size="sm" tone="plain" />
            </View>
          </View>

          <Segmented
            value={direction}
            onChange={setDirection}
            options={[
              { key: 'deposit', label: 'Deposit ↓' },
              { key: 'withdraw', label: 'Withdraw ↑' },
            ]}
          />
          <Text style={tw`-mt-2 font-sans text-[12px] font-bold text-ink-400`}>
            {direction === 'deposit' ? 'Wallet → Savings' : 'Savings → Wallet'}
          </Text>
          <Input
            testID="savings-amount-input"
            label="Amount"
            keyboardType="number-pad"
            placeholder="0"
            value={raw}
            onChangeText={(t) => setRaw(t.replace(/[^0-9]/g, ''))}
            error={overdraftMsg || error || undefined}
            editable={!busy}
          />
          <Button variant="mint" block size="lg" loading={busy} disabled={!canSubmit} onPress={() => void submit()}>
            {direction === 'deposit' ? 'Deposit to savings' : 'Withdraw to wallet'}
          </Button>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
