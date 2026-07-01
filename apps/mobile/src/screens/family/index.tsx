// Parent: Family overview (#19) — the parent Home, rebuilt to the design canvas:
// a "Parent / Family" header, a row of kid cards (Avatar + name + CoinBadge
// balance), and a Quick-actions grid that jumps to the relevant tab. Reads the
// roster + balances through the parent (GoTrue) session client; balances refresh
// live via a wallets subscription.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listKidsWithBalances, signOut, subscribeToTable, type KidWithBalance } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Avatar } from '../../components/ui/Avatar';
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import { useParentNav } from '../../navigation/ParentNav';
import tw from '../../lib/tw';

// Quick actions surface the non-tab destinations (Kids, Schedule) + common
// shortcuts. `tab` is the route name (tab or pushed stack screen) to navigate to.
const ACTIONS: { id: string; label: string; icon: IconName; tile: string; fg: string; tab: string }[] = [
  { id: 'bonus', label: 'Give bonus', icon: 'star', tile: 'bg-coin-soft', fg: '#8A6400', tab: 'Kids' },
  { id: 'chore', label: 'New chore', icon: 'plus', tile: 'bg-indigo-soft', fg: '#5B63E6', tab: 'Chores' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar-clock', tile: 'bg-mint-soft', fg: '#0A6A46', tab: 'Schedule' },
  { id: 'rewards', label: 'Rewards', icon: 'gift', tile: 'bg-orange-soft', fg: '#8A4309', tab: 'Rewards' },
];

function KidCard({ kid, first, onPress }: { kid: KidWithBalance; first: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={kid.display_name}
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
    </Pressable>
  );
}

// Dashed "+ Add kid" tile that sits alongside the kid cards on the Family hub.
function AddKidTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="add-kid"
      accessibilityRole="button"
      accessibilityLabel="Add kid"
      onPress={onPress}
      style={tw`flex-1 items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-300 px-3 py-4`}
    >
      <View style={tw`h-12 w-12 items-center justify-center rounded-full bg-indigo-soft`}>
        <Icon name="plus" size={24} color="#5B63E6" />
      </View>
      <Text style={tw`font-display text-[14px] font-extrabold text-ink-700`}>Add kid</Text>
    </Pressable>
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

// One row in the settings sheet.
function MenuRow({
  testID,
  icon,
  label,
  color = '#211E27',
  onPress,
}: {
  testID: string;
  icon: IconName;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={tw`flex-row items-center gap-3 rounded-md px-3 py-3`}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={tw.style('font-display text-[15px] font-extrabold', { color })}>{label}</Text>
    </Pressable>
  );
}

// Settings menu — a small sheet anchored top-right. Account/family config
// (Co-parents, Family code) and Log out. Kid management lives on Home, not here.
// Tapping the scrim closes it.
function SettingsMenu({
  open,
  top,
  onClose,
  onCoParents,
  onCode,
  onLogout,
}: {
  open: boolean;
  top: number;
  onClose: () => void;
  onCoParents: () => void;
  onCode: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tw`flex-1`}>
        {/* Scrim sits BEHIND the menu (sibling, not parent) so the menu's own
            taps aren't swallowed by the backdrop's press handler. */}
        <Pressable accessibilityLabel="Close menu" style={tw`absolute inset-0`} onPress={onClose} />
        <View
          style={tw.style('absolute right-4 w-56 gap-0.5 rounded-card bg-surface-card p-2', {
            top: top + 52,
            shadowColor: 'rgba(32,36,58,1)',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 24,
            elevation: 8,
          })}
        >
          <MenuRow testID="settings-coparents" icon="users" label="Co-parents" onPress={onCoParents} />
          <MenuRow testID="settings-code" icon="lock" label="Family code" onPress={onCode} />
          <View style={tw`my-1 h-px bg-ink-100`} />
          <MenuRow
            testID="parent-logout"
            icon="log-out"
            label="Log out"
            color="#B11216"
            onPress={onLogout}
          />
        </View>
      </View>
    </Modal>
  );
}

export function FamilyOverviewScreen() {
  const nav = useParentNav();
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
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
    <View style={tw`flex-1 bg-surface-page`}>
      <SettingsMenu
        open={menuOpen}
        top={insets.top}
        onClose={() => setMenuOpen(false)}
        onCoParents={() => {
          setMenuOpen(false);
          nav.navigate('CoParents');
        }}
        onCode={() => {
          setMenuOpen(false);
          nav.navigate('FamilyCode');
        }}
        onLogout={() => {
          setMenuOpen(false);
          void signOut(supabase);
        }}
      />
      <ScrollView
        style={tw`flex-1 bg-surface-page`}
        contentContainerStyle={tw.style('gap-4 px-4 pb-4', isRegular ? 'mx-auto w-full max-w-[640px]' : '', {
          paddingTop: insets.top + 12,
        })}
      >
      <View style={tw`flex-row items-start justify-between`}>
        <View>
          <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
            Parent
          </Text>
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Family</Text>
        </View>
        <Pressable
          testID="parent-settings"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={tw.style('h-10 w-10 items-center justify-center rounded-full bg-surface-card', {
            shadowColor: 'rgba(32,36,58,1)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
          })}
        >
          <Icon name="settings" size={22} color="#443F4E" />
        </Pressable>
      </View>

      {error ? (
        <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
          <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
        </View>
      ) : null}

      {kids.length > 0 ? (
        <View style={tw`flex-row flex-wrap gap-3`}>
          {kids.map((k, i) => (
            <KidCard key={k.id} kid={k} first={i === 0} onPress={() => nav.navigate('Kids')} />
          ))}
          <AddKidTile onPress={() => nav.navigate('Kids', { create: true })} />
        </View>
      ) : (
        <Pressable
          onPress={() => nav.navigate('Kids', { create: true })}
          style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}
        >
          <Icon name="smile" size={40} color="#A39CAD" />
          <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
            Add your first kid
          </Text>
          <Text style={tw`text-center font-sans text-[13px] font-bold text-ink-400`}>
            Tap to set up a child profile.
          </Text>
        </Pressable>
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
    </View>
  );
}
