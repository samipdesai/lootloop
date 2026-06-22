// KidsScreen — the Parent "Kids" surface (#15). Self-contained: owns its own
// list↔form navigation via local view state (no reliance on the app root
// navigator). On mount it fetches the kid roster. Loading / empty / error states
// are all rendered here so the surface is never blank. The add/edit form,
// change-PIN form, and family device-code panel are reused child components.
// One component tree; children branch on size class where it improves layout.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listKids, deleteKid, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { useParentParams } from '../../navigation/ParentNav';
import { KidList } from './KidList';
import { KidForm } from './KidForm';
import { ChangePinForm } from './ChangePinForm';
import { AwardBonusForm } from './AwardBonusForm';
import { PointHistory } from './PointHistory';

type ScreenView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; kid: KidProfile }
  | { mode: 'pin'; kid: KidProfile }
  | { mode: 'bonus'; kid: KidProfile }
  | { mode: 'history'; kid: KidProfile };

function CenteredState({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <View style={tw.style('flex-1 items-center justify-center bg-surface-page px-8', { paddingTop: top })}>
      {children}
    </View>
  );
}

export function KidsScreen() {
  const insets = useSafeAreaInsets();
  const params = useParentParams();
  // Opened with { create: true } from the Home "Add kid" tile → start on the form.
  const startCreate = (params as { create?: boolean } | undefined)?.create ?? false;
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ScreenView>(startCreate ? { mode: 'create' } : { mode: 'list' });
  const [rowError, setRowError] = useState('');
  // Inline confirmation banner after a bonus award (no blocking Alert.alert).
  const [rowNote, setRowNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await listKids(supabase);
    setLoading(false);
    if (error) {
      setLoadError("Couldn't load kids. Try again.");
      return;
    }
    setKids(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback(() => {
    setView({ mode: 'list' });
    void load();
  }, [load]);

  const handleBonusAwarded = useCallback((kid: KidProfile, amount: number) => {
    setView({ mode: 'list' });
    setRowError('');
    setRowNote(`Gave ${amount} pts to ${kid.display_name}.`);
  }, []);

  const handleDelete = useCallback(async (kid: KidProfile) => {
    setRowError('');
    const { error } = await deleteKid(supabase, kid.id);
    if (error) {
      setRowError(`Could not delete ${kid.display_name}. Try again.`);
      return;
    }
    setKids((prev) => prev.filter((k) => k.id !== kid.id));
  }, []);

  const closeForm = () => setView({ mode: 'list' });

  // --- Base: the roster (loading / error / empty / list). Forms render in a
  //     page-sheet modal ON TOP, so tapping an action slides the form up. -------
  let base: React.ReactNode;
  if (loading) {
    base = (
      <CenteredState top={insets.top}>
        <ActivityIndicator size="large" color="#F4720E" />
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>Loading kids…</Text>
      </CenteredState>
    );
  } else if (loadError) {
    base = (
      <CenteredState top={insets.top}>
        <View style={tw`w-full max-w-[420px] gap-4`}>
          <FormError message={loadError} />
          <Button block onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </CenteredState>
    );
  } else if (kids.length === 0) {
    base = (
      <CenteredState top={insets.top}>
        <View style={tw`w-full max-w-[460px] gap-6`}>
          <View style={tw`items-center`}>
            <Icon name="smile" size={40} color="#A39CAD" />
            <Text style={tw`mt-3 text-center font-display text-[20px] font-extrabold text-ink-900`}>
              No kids yet
            </Text>
            <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
              Tap ＋ to add one.
            </Text>
            <View style={tw`mt-6`}>
              <Button onPress={() => setView({ mode: 'create' })} accessibilityLabel="New kid">
                ＋ New kid
              </Button>
            </View>
          </View>
        </View>
      </CenteredState>
    );
  } else {
    base = (
      <View style={tw`flex-1 bg-surface-page`} pointerEvents="box-none">
        {rowError ? (
          <View style={tw.style('px-5', { paddingTop: insets.top + 8 })}>
            <FormError message={rowError} />
          </View>
        ) : null}
        {rowNote ? (
          <View style={tw.style('px-5', { paddingTop: insets.top + 8 })}>
            <View style={tw`rounded-card bg-mint-soft px-4 py-3`}>
              <Text style={tw`font-sans text-[14px] font-bold text-mint-ink`}>{rowNote}</Text>
            </View>
          </View>
        ) : null}
        <KidList
          kids={kids}
          onNew={() => setView({ mode: 'create' })}
          onEdit={(kid) => setView({ mode: 'edit', kid })}
          onChangePin={(kid) => setView({ mode: 'pin', kid })}
          onGiveBonus={(kid) => {
            setRowNote('');
            setView({ mode: 'bonus', kid });
          }}
          onHistory={(kid) => {
            setRowNote('');
            setView({ mode: 'history', kid });
          }}
          onDelete={handleDelete}
        />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      {base}
      {/* Action forms as a native page-sheet (smooth slide up/down + swipe-down). */}
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
    </View>
  );
}
