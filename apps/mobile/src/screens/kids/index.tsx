// KidsScreen — the Parent "Kids" surface (#15). Self-contained: owns its own
// list↔form navigation via local view state (no reliance on the app root
// navigator). On mount it fetches the kid roster. Loading / empty / error states
// are all rendered here so the surface is never blank. The add/edit form,
// change-PIN form, and family device-code panel are reused child components.
// One component tree; children branch on size class where it improves layout.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listKids, deleteKid, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { KidList } from './KidList';
import { KidForm } from './KidForm';
import { ChangePinForm } from './ChangePinForm';
import { FamilyCodePanel } from './FamilyCodePanel';

type ScreenView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; kid: KidProfile }
  | { mode: 'pin'; kid: KidProfile };

function CenteredState({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <View style={tw.style('flex-1 items-center justify-center bg-surface-page px-8', { paddingTop: top })}>
      {children}
    </View>
  );
}

export function KidsScreen() {
  const insets = useSafeAreaInsets();
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ScreenView>({ mode: 'list' });
  const [rowError, setRowError] = useState('');

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

  const handleDelete = useCallback(async (kid: KidProfile) => {
    setRowError('');
    const { error } = await deleteKid(supabase, kid.id);
    if (error) {
      setRowError(`Could not delete ${kid.display_name}. Try again.`);
      return;
    }
    setKids((prev) => prev.filter((k) => k.id !== kid.id));
  }, []);

  // --- Form modes -------------------------------------------------------------
  if (view.mode === 'create') {
    return <KidForm onSaved={handleSaved} onCancel={() => setView({ mode: 'list' })} />;
  }
  if (view.mode === 'edit') {
    return <KidForm kid={view.kid} onSaved={handleSaved} onCancel={() => setView({ mode: 'list' })} />;
  }
  if (view.mode === 'pin') {
    return (
      <ChangePinForm
        kid={view.kid}
        onSaved={() => setView({ mode: 'list' })}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  // --- List mode states -------------------------------------------------------
  if (loading) {
    return (
      <CenteredState top={insets.top}>
        <ActivityIndicator size="large" color="#F4720E" />
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>Loading kids…</Text>
      </CenteredState>
    );
  }

  if (loadError) {
    return (
      <CenteredState top={insets.top}>
        <View style={tw`w-full max-w-[420px] gap-4`}>
          <FormError message={loadError} />
          <Button block onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </CenteredState>
    );
  }

  if (kids.length === 0) {
    return (
      <CenteredState top={insets.top}>
        <View style={tw`w-full max-w-[460px] gap-6`}>
          <View style={tw`items-center`}>
            <Text style={tw`text-[40px]`}>🧒</Text>
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
          {/* The device code is needed before a kid can sign in, so surface it
              even with an empty roster. */}
          <FamilyCodePanel />
        </View>
      </CenteredState>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`} pointerEvents="box-none">
      {rowError ? (
        <View style={tw.style('px-5', { paddingTop: insets.top + 8 })}>
          <FormError message={rowError} />
        </View>
      ) : null}
      <KidList
        kids={kids}
        onNew={() => setView({ mode: 'create' })}
        onEdit={(kid) => setView({ mode: 'edit', kid })}
        onChangePin={(kid) => setView({ mode: 'pin', kid })}
        onDelete={handleDelete}
      />
    </View>
  );
}
