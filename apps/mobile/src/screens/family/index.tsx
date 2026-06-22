// Parent: Family overview (#19) — the parent Home, rebuilt to the design canvas:
// a "Parent / Family" header, a row of kid cards (Avatar + name + CoinBadge
// balance), and a Quick-actions grid that jumps to the relevant tab. Reads the
// roster + balances through the parent (GoTrue) session client; balances refresh
// live via a wallets subscription.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { listKidsWithBalances, subscribeToTable, type KidWithBalance } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Avatar } from '../../components/ui/Avatar';
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';

const ACTIONS: { id: string; label: string; icon: IconName; tile: string; fg: string; tab: string }[] = [
  { id: 'bonus', label: 'Give bonus', icon: 'star', tile: 'bg-coin-soft', fg: '#8A6400', tab: 'Kids' },
  { id: 'chore', label: 'New chore', icon: 'plus', tile: 'bg-indigo-soft', fg: '#5B63E6', tab: 'Chores' },
  { id: 'approve', label: 'Approvals', icon: 'inbox', tile: 'bg-mint-soft', fg: '#0A6A46', tab: 'Approvals' },
  { id: 'rewards', label: 'Rewards', icon: 'gift', tile: 'bg-orange-soft', fg: '#8A4309', tab: 'Rewards' },
];

function KidCard({ kid, first }: { kid: KidWithBalance; first: boolean }) {
  return (
    <View
      style={tw.style('flex-1 items-center gap-2 rounded-card bg-surface-card px-3 py-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <Avatar name={kid.display_name} src={kid.avatar_url} size={48} ring={first} />
      <Text numberOfLines={1} style={tw`font-display text-[14px] font-extrabold text-ink-900`}>
        {kid.display_name}
      </Text>
      <CoinBadge amount={kid.wallet_balance} size="sm" tone="soft" />
    </View>
  );
}

function ActionCard({ label, icon, tile, fg, onPress }: (typeof ACTIONS)[number] & { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={tw.style('flex-1 flex-row items-center gap-2.5 rounded-card bg-surface-card px-4 py-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <View style={tw.style(`h-10 w-10 items-center justify-center rounded-md ${tile}`)}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <Text style={tw`font-display text-[14px] font-extrabold text-ink-900`}>{label}</Text>
    </Pressable>
  );
}

export function FamilyOverviewScreen() {
  const nav = useNavigation<{ navigate: (s: string) => void }>();
  const isRegular = useSizeClass() === 'regular';
  const [kids, setKids] = useState<KidWithBalance[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await listKidsWithBalances(supabase);
    if (err || !data) {
      setError("Couldn't load your family. Pull to try again.");
      setKids([]);
      return;
    }
    setKids(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (#41): kid balances refresh live as chores get approved / bonuses
  // land. RLS scopes the wallets stream to this parent's family.
  useEffect(() => {
    const unsub = subscribeToTable(supabase, { table: 'wallets', onChange: () => void load() });
    return () => unsub();
  }, [load]);

  if (kids === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#5B63E6" />
      </View>
    );
  }

  // Pair the quick actions into rows of two for the grid.
  const actionRows = [ACTIONS.slice(0, 2), ACTIONS.slice(2, 4)];

  return (
    <ScrollView
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style('gap-4 px-4 py-4', isRegular ? 'mx-auto w-full max-w-[640px]' : '')}
    >
      <View>
        <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
          Parent
        </Text>
        <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Family</Text>
      </View>

      {error ? (
        <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
          <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
        </View>
      ) : null}

      {kids.length > 0 ? (
        <View style={tw`flex-row gap-3`}>
          {kids.map((k, i) => (
            <KidCard key={k.id} kid={k} first={i === 0} />
          ))}
        </View>
      ) : (
        <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
          <Icon name="smile" size={40} color="#A39CAD" />
          <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
            No kids yet — add one from the Kids tab.
          </Text>
        </View>
      )}

      <Text style={tw`mt-1 font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
        Quick actions
      </Text>
      <View style={tw`gap-3`}>
        {actionRows.map((row, i) => (
          <View key={i} style={tw`flex-row gap-3`}>
            {row.map((a) => (
              <ActionCard key={a.id} {...a} onPress={() => nav.navigate(a.tab)} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
