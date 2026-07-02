// ScheduleScreen — the Parent "Schedule" surface (#36). Self-contained: owns its
// own list↔form navigation via local view state (no reliance on the app root
// navigator). On mount it fetches schedule items + kids and resolves kid_id →
// name for the per-kid grouping. Loading / empty / error states are all rendered
// here so the surface is never blank. One component tree; child components branch
// on size class where it improves layout.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listScheduleItems,
  listKids,
  deleteScheduleItem,
  type ScheduleItem,
  type KidProfile,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useRefetchOnForeground } from '../../hooks/useRefetchOnForeground';
import { Button } from '../../components/ui/Button';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { ScheduleList } from './ScheduleList';
import { ScheduleForm } from './ScheduleForm';

type ScreenView = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; item: ScheduleItem };

function CenteredState({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <View style={tw.style('flex-1 items-center justify-center bg-surface-page px-8', { paddingTop: top })}>
      {children}
    </View>
  );
}

export function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ScreenView>({ mode: 'list' });
  const [rowError, setRowError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [itemsRes, kidsRes] = await Promise.all([listScheduleItems(supabase), listKids(supabase)]);
    if (itemsRes.error || kidsRes.error) {
      setLoading(false);
      setLoadError("Couldn't load the schedule. Pull to refresh or try again.");
      return;
    }
    setItems(itemsRes.data ?? []);
    setKids(kidsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Self-heal on foreground: recover a transient load failure without a re-login.
  useRefetchOnForeground(() => void load());

  const kidsById = useMemo(() => {
    const map = new Map<string, KidProfile>();
    for (const k of kids) map.set(k.id, k);
    return map;
  }, [kids]);

  const handleSaved = useCallback(() => {
    setView({ mode: 'list' });
    void load();
  }, [load]);

  const handleDelete = useCallback(async (item: ScheduleItem) => {
    setRowError('');
    const { error } = await deleteScheduleItem(supabase, item.id);
    if (error) {
      setRowError('Could not delete that item. Try again.');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }, []);

  // --- Form modes -------------------------------------------------------------
  if (view.mode === 'create') {
    return <ScheduleForm kids={kids} onSaved={handleSaved} onCancel={() => setView({ mode: 'list' })} />;
  }
  if (view.mode === 'edit') {
    return (
      <ScheduleForm
        item={view.item}
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
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>Loading schedule…</Text>
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

  if (items.length === 0) {
    return (
      <CenteredState top={insets.top}>
        <Text style={tw`text-[40px]`}>🗓️</Text>
        <Text style={tw`mt-3 text-center font-display text-[20px] font-extrabold text-ink-900`}>
          No schedule items yet
        </Text>
        <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          Tap ＋ to add one.
        </Text>
        <View style={tw`mt-6`}>
          <Button onPress={() => setView({ mode: 'create' })} accessibilityLabel="New item">
            ＋ New item
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
      <ScheduleList
        items={items}
        kidsById={kidsById}
        onNew={() => setView({ mode: 'create' })}
        onEdit={(item) => setView({ mode: 'edit', item })}
        onDelete={handleDelete}
      />
    </View>
  );
}
