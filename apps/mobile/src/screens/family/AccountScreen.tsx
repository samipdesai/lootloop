// Parent: Account (Settings -> Account). Two destructive operations (#52):
//
//   * Leave family    — a co-parent removes ONLY themselves (confirm dialog ->
//                        leaveFamily). If they're the LAST parent the Edge Function
//                        rejects it (403 last_parent); we redirect them to delete.
//   * Delete family   — any parent HARD-deletes the whole family + all data. Gated
//                        behind a TYPE-TO-CONFIRM field: the destructive button
//                        stays disabled until the parent types the family name
//                        exactly (matchesFamilyName).
//
// Either success invalidates the parent's auth session server-side, so we sign
// out locally afterward — onAuthStateChange flips RootNavigator back to the auth
// stack. Routed from the Home settings menu (FamilyOverviewScreen). Layout is a
// single column so it fits the narrow iPad split-view detail pane (no two-up
// button rows).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deleteFamily,
  getFamilySummary,
  isLastParentError,
  leaveFamily,
  signOut,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { useParentNav } from '../../navigation/ParentNav';
import { matchesFamilyName } from './confirm';
import tw from '../../lib/tw';

type Busy = null | 'leave' | 'delete';

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useParentNav();

  const [summary, setSummary] = useState<{ name: string; kid_count: number } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    const { data, error } = await getFamilySummary(supabase);
    if (error || !data) {
      setLoadError("Couldn't load your account. Pull to try again.");
      return;
    }
    setSummary(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Both operations end with the parent's session invalid -> sign out so the app
  // returns to the auth stack (RootNavigator reacts to SIGNED_OUT).
  const finishWithSignOut = useCallback(async () => {
    await signOut(supabase);
  }, []);

  const onLeave = useCallback(() => {
    Alert.alert(
      'Leave this family?',
      'You will be removed as a parent. The family and the other parents keep everything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionError('');
              setBusy('leave');
              const { error } = await leaveFamily(supabase);
              if (error) {
                if (await isLastParentError(error)) {
                  setActionError("You're the only parent — delete the family instead.");
                } else {
                  setActionError("Couldn't leave the family. Please try again.");
                }
                setBusy(null);
                return;
              }
              await finishWithSignOut();
            })();
          },
        },
      ],
    );
  }, [finishWithSignOut]);

  const onDelete = useCallback(() => {
    void (async () => {
      setActionError('');
      setBusy('delete');
      const { error } = await deleteFamily(supabase);
      if (error) {
        setActionError("Couldn't delete the family. Please try again.");
        setBusy(null);
        return;
      }
      await finishWithSignOut();
    })();
  }, [finishWithSignOut]);

  if (summary === null && !loadError) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-surface-page`}>
        <ActivityIndicator color="#5B63E6" />
      </View>
    );
  }

  const familyName = summary?.name ?? '';
  const kidCount = summary?.kid_count ?? 0;
  const kidsLabel = `${kidCount} ${kidCount === 1 ? 'kid' : 'kids'}`;
  const canDelete = !busy && matchesFamilyName(confirmName, familyName);

  return (
    <ScrollView
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style('gap-5 px-5 pb-10', { paddingTop: insets.top + 12 })}
    >
      <View style={tw`flex-row items-center gap-2`}>
        {navigation.canGoBack() ? (
          <Pressable
            testID="parent-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={tw`h-10 w-10 items-center justify-center rounded-full bg-surface-card`}
          >
            <Icon name="chevron-left" size={22} color="#211E27" />
          </Pressable>
        ) : null}
        <View>
          <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
            Settings
          </Text>
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Account</Text>
        </View>
      </View>

      {loadError ? (
        <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
          <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{loadError}</Text>
        </View>
      ) : null}

      {actionError ? (
        <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
          <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{actionError}</Text>
        </View>
      ) : null}

      {/* Leave family */}
      <View style={tw`gap-3 rounded-card bg-surface-card p-5`}>
        <Text style={tw`font-display text-[18px] font-extrabold text-ink-900`}>Leave family</Text>
        <Text style={tw`font-sans text-[14px] font-semibold text-ink-500`}>
          Remove just yourself as a parent. The family and the other parents keep everything. You
          can't be the only parent.
        </Text>
        <Button
          testID="leave-family"
          variant="indigo"
          block
          loading={busy === 'leave'}
          disabled={busy === 'delete'}
          onPress={onLeave}
        >
          Leave family
        </Button>
      </View>

      {/* Delete family (destructive, type-to-confirm) */}
      <View
        style={tw.style('gap-3 rounded-card bg-surface-card p-5', {
          borderWidth: 2,
          borderColor: '#F3C0C2',
        })}
      >
        <Text style={tw`font-display text-[18px] font-extrabold text-danger-ink`}>Delete family</Text>
        <Text style={tw`font-sans text-[14px] font-semibold text-ink-500`}>
          This permanently deletes everything for {kidsLabel} — chores, rewards, points, savings, and
          reading. This can't be undone.
        </Text>
        <Text style={tw`font-sans text-[14px] font-semibold text-ink-700`}>
          Type <Text style={tw`font-extrabold text-ink-900`}>{familyName}</Text> to confirm.
        </Text>
        <Input
          testID="confirm-delete-input"
          value={confirmName}
          onChangeText={setConfirmName}
          placeholder="Family name"
          autoCapitalize="none"
          autoCorrect={false}
          editable={busy !== 'delete'}
        />
        <Pressable
          testID="confirm-delete-button"
          accessibilityRole="button"
          accessibilityLabel="Delete family permanently"
          accessibilityState={{ disabled: !canDelete, busy: busy === 'delete' }}
          disabled={!canDelete}
          onPress={onDelete}
          style={tw.style(
            'h-14 w-full flex-row items-center justify-center gap-2 rounded-pill px-7',
            canDelete ? 'bg-danger' : 'bg-ink-200',
          )}
        >
          {busy === 'delete' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={tw.style(
                'font-display text-[18px] font-bold',
                canDelete ? 'text-white' : 'text-ink-400',
              )}
            >
              Delete family
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
