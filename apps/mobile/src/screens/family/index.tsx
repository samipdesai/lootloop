// Parent Home (#19, restructured). The family hub: a kid-management roster
// (avatar + name + age + wallet balance + Bonus/History/Edit/PIN/Remove) above a
// Quick-actions grid. Add kid / Co-parents / Family code / Log out live in the
// ⚙ settings sheet. Kid balances refresh live via a wallets subscription. Kid
// action forms open as page-sheet modals here — the standalone Kids screen was
// retired and folded into Home.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deleteKid,
  listKidsWithBalances,
  signOut,
  subscribeToTable,
  type KidWithBalance,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useRefetchOnForeground } from '../../hooks/useRefetchOnForeground';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useParentNav } from '../../navigation/ParentNav';
import { KidRow } from '../kids/KidList';
import { KidForm } from '../kids/KidForm';
import { ChangePinForm } from '../kids/ChangePinForm';
import { AwardBonusForm } from '../kids/AwardBonusForm';
import { PointHistory } from '../kids/PointHistory';
import tw from '../../lib/tw';

// Quick actions jump to the relevant tab / pushed screen. Bonus is no longer here
// (it's an inline per-kid action on the roster).
const ACTIONS: { id: string; label: string; icon: IconName; tile: string; fg: string; tab: string }[] = [
  { id: 'chore', label: 'New chore', icon: 'plus', tile: 'bg-indigo-soft', fg: '#5B63E6', tab: 'Chores' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar-clock', tile: 'bg-mint-soft', fg: '#0A6A46', tab: 'Schedule' },
  { id: 'rewards', label: 'Rewards', icon: 'gift', tile: 'bg-orange-soft', fg: '#8A4309', tab: 'Rewards' },
];

// The active kid-action modal (mirrors the retired KidsScreen state machine).
type ScreenView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; kid: KidWithBalance }
  | { mode: 'pin'; kid: KidWithBalance }
  | { mode: 'bonus'; kid: KidWithBalance }
  | { mode: 'history'; kid: KidWithBalance };

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

// Settings menu — a small sheet anchored top-right: Add kid, Co-parents,
// Family code, Log out. Tapping the scrim closes it.
function SettingsMenu({
  open,
  top,
  onClose,
  onAddKid,
  onCoParents,
  onCode,
  onLogout,
}: {
  open: boolean;
  top: number;
  onClose: () => void;
  onAddKid: () => void;
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
          <MenuRow testID="settings-add-kid" icon="plus" label="Add kid" onPress={onAddKid} />
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
  const [view, setView] = useState<ScreenView>({ mode: 'list' });
  // Inline confirmation after a bonus award (no blocking Alert.alert).
  const [note, setNote] = useState('');

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

  // Self-heal: reopening the app re-runs the roster load, so a transient failure
  // recovers on foreground rather than persisting until sign-out.
  useRefetchOnForeground(() => void load());

  // Realtime (#41): kid balances refresh live as chores get approved / bonuses
  // land. RLS scopes the wallets stream to this parent's family.
  useEffect(() => {
    const unsub = subscribeToTable(supabase, { table: 'wallets', onChange: () => void load() });
    return () => unsub();
  }, [load]);

  const closeForm = () => setView({ mode: 'list' });

  const handleSaved = useCallback(() => {
    setView({ mode: 'list' });
    void load();
  }, [load]);

  const handleBonusAwarded = useCallback((kid: KidWithBalance, amount: number) => {
    setView({ mode: 'list' });
    setNote(`Gave ${amount} pts to ${kid.display_name}.`);
    void load();
  }, [load]);

  const handleDelete = useCallback(async (kid: KidWithBalance) => {
    setError('');
    const { error: err } = await deleteKid(supabase, kid.id);
    if (err) {
      setError(`Could not delete ${kid.display_name}. Try again.`);
      return;
    }
    setKids((prev) => (prev ? prev.filter((k) => k.id !== kid.id) : prev));
  }, []);

  if (kids === null) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#5B63E6" />
      </View>
    );
  }

  // Pair the quick actions into rows of two; a lone last card keeps half width
  // via a flex spacer.
  const actionRows = [ACTIONS.slice(0, 2), ACTIONS.slice(2)];

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <SettingsMenu
        open={menuOpen}
        top={insets.top}
        onClose={() => setMenuOpen(false)}
        onAddKid={() => {
          setMenuOpen(false);
          setNote('');
          setView({ mode: 'create' });
        }}
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

      {/* Kid action forms as a native page-sheet (smooth slide up/down). */}
      <Modal
        visible={view.mode !== 'list'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <View style={tw`flex-1 bg-surface-page`}>
          {view.mode === 'create' ? <KidForm onSaved={handleSaved} onCancel={closeForm} /> : null}
          {view.mode === 'edit' ? (
            <KidForm kid={view.kid} onSaved={handleSaved} onCancel={closeForm} />
          ) : null}
          {view.mode === 'pin' ? (
            <ChangePinForm kid={view.kid} onSaved={closeForm} onCancel={closeForm} />
          ) : null}
          {view.mode === 'bonus' ? (
            <AwardBonusForm
              kid={view.kid}
              onSaved={(amount) => handleBonusAwarded(view.kid, amount)}
              onCancel={closeForm}
            />
          ) : null}
          {view.mode === 'history' ? <PointHistory kid={view.kid} onBack={closeForm} /> : null}
        </View>
      </Modal>

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

        {note ? (
          <View style={tw`rounded-card bg-mint-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-mint-ink`}>{note}</Text>
          </View>
        ) : null}

        {/* Kid roster — full management cards */}
        {kids.length > 0 ? (
          <View style={tw`gap-3`}>
            {kids.map((k) => (
              <KidRow
                key={k.id}
                kid={k}
                balance={k.wallet_balance}
                onEdit={() => {
                  setNote('');
                  setView({ mode: 'edit', kid: k });
                }}
                onChangePin={() => {
                  setNote('');
                  setView({ mode: 'pin', kid: k });
                }}
                onGiveBonus={() => {
                  setNote('');
                  setView({ mode: 'bonus', kid: k });
                }}
                onHistory={() => {
                  setNote('');
                  setView({ mode: 'history', kid: k });
                }}
                onDelete={() => handleDelete(k)}
              />
            ))}
          </View>
        ) : (
          <Pressable
            testID="add-kid"
            onPress={() => setView({ mode: 'create' })}
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
              {row.length === 1 ? <View style={tw`flex-1`} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
