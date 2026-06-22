// ChoresScreen — the Parent "Chores" surface (#12 Create/Edit + #13 List).
// Self-contained: owns its own list↔form navigation via local view state (no
// reliance on the app root navigator). On mount it fetches chores + kids and
// resolves assigned_kid_id → name. Loading / empty / error states are all
// rendered here so the surface is never blank. One component tree; child
// components branch on size class where it improves layout.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listChores, listKids, deleteChore, type Chore, type KidProfile } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { ChoreList } from './ChoreList';
import { ChoreForm } from './ChoreForm';

type ScreenView =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; chore: Chore };

function CenteredState({
  top,
  children,
}: {
  top: number;
  children: React.ReactNode;
}) {
  return (
    <View style={tw.style('flex-1 items-center justify-center bg-surface-page px-8', { paddingTop: top })}>
      {children}
    </View>
  );
}

export function ChoresScreen() {
  const insets = useSafeAreaInsets();
  const [chores, setChores] = useState<Chore[]>([]);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ScreenView>({ mode: 'list' });
  const [rowError, setRowError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [choresRes, kidsRes] = await Promise.all([listChores(supabase), listKids(supabase)]);
    if (choresRes.error || kidsRes.error) {
      setLoading(false);
      setLoadError("Couldn't load chores. Pull to refresh or try again.");
      return;
    }
    setChores(choresRes.data ?? []);
    setKids(kidsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kidsById = useMemo(() => {
    const map = new Map<string, KidProfile>();
    for (const k of kids) map.set(k.id, k);
    return map;
  }, [kids]);

  const handleSaved = useCallback(() => {
    setView({ mode: 'list' });
    void load();
  }, [load]);

  const handleDelete = useCallback(async (chore: Chore) => {
    setRowError('');
    const { error } = await deleteChore(supabase, chore.id);
    if (error) {
      setRowError('Could not delete that chore. Try again.');
      return;
    }
    setChores((prev) => prev.filter((c) => c.id !== chore.id));
  }, []);

  // --- Form modes -------------------------------------------------------------
  if (view.mode === 'create') {
    return (
      <ChoreForm
        kids={kids}
        onSaved={handleSaved}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }
  if (view.mode === 'edit') {
    return (
      <ChoreForm
        chore={view.chore}
        kids={kids}
        onSaved={handleSaved}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  // --- List mode states -------------------------------------------------------
  if (loading) {
    return (
      <CenteredState top={insets.top}>
        <ActivityIndicator size="large" color="#F4720E" />
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>
          Loading chores…
        </Text>
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

  if (chores.length === 0) {
    return (
      <CenteredState top={insets.top}>
        <Icon name="list-todo" size={40} color="#A39CAD" />
        <Text style={tw`mt-3 text-center font-display text-[20px] font-extrabold text-ink-900`}>
          No chores yet
        </Text>
        <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          Tap ＋ to add one.
        </Text>
        <View style={tw`mt-6`}>
          <Button onPress={() => setView({ mode: 'create' })} accessibilityLabel="New chore">
            ＋ New chore
          </Button>
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
      <ChoreList
        chores={chores}
        kidsById={kidsById}
        onNew={() => setView({ mode: 'create' })}
        onEdit={(chore) => setView({ mode: 'edit', chore })}
        onDelete={handleDelete}
      />
    </View>
  );
}
