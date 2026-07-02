// RewardsScreen — the Parent "Rewards" surface: a "Store" catalog (#22 CRUD) and
// a "To give" fulfillment queue (#25). Self-contained: owns its own tab state and
// the Store's list↔form navigation via local view state (no reliance on the app
// root navigator). Each tab fetches independently via the supabase singleton; RLS
// scopes every query to the caller's family.
//
// Adaptive (one component tree, branched on useSizeClass): compact (iPhone) ->
// single column; regular (iPad) -> centred max-width column with two-up cards.
//
// No Alert.alert (blocks the JS bridge) — errors render inline as banners.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deleteReward,
  getMyParentProfile,
  listPurchases,
  listRewards,
  markPurchaseGiven,
  subscribeToTable,
  type FulfillmentItem,
  type Reward,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useRefetchOnForeground } from '../../hooks/useRefetchOnForeground';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Icon } from '../../components/ui/Icon';
import { FormError } from '../auth/AuthScreen';
import tw from '../../lib/tw';
import { RewardForm } from './RewardForm';
import { StoreList } from './StoreList';
import { FulfillmentList, type RowState } from './FulfillmentList';

type Tab = 'store' | 'give';

// Store sub-navigation: list <-> create/edit form.
type StoreView = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; reward: Reward };

const TABS = [
  { value: 'store', label: 'Store' },
  { value: 'give', label: 'To give' },
];

export function RewardsScreen() {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('store');
  const [storeView, setStoreView] = useState<StoreView>({ mode: 'list' });

  // --- Store data ------------------------------------------------------------
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState('');
  const [storeRowError, setStoreRowError] = useState('');

  const loadStore = useCallback(async () => {
    setStoreLoading(true);
    setStoreError('');
    const { data, error } = await listRewards(supabase);
    if (error) {
      setStoreLoading(false);
      setStoreError("Couldn't load your rewards. Tap retry.");
      return;
    }
    setRewards(data ?? []);
    setStoreLoading(false);
  }, []);

  // --- Fulfillment data ------------------------------------------------------
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [giveLoading, setGiveLoading] = useState(true);
  const [giveError, setGiveError] = useState('');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const loadGive = useCallback(async () => {
    setGiveLoading(true);
    setGiveError('');
    const [profileRes, purchasesRes] = await Promise.all([
      getMyParentProfile(supabase),
      listPurchases(supabase, 'purchased'),
    ]);
    if (profileRes.error || !profileRes.data) {
      setGiveError("We couldn't load your account. Tap retry.");
      setGiveLoading(false);
      return;
    }
    if (purchasesRes.error || !purchasesRes.data) {
      setGiveError("We couldn't load the fulfillment queue. Tap retry.");
      setGiveLoading(false);
      return;
    }
    setReviewerId(profileRes.data.id);
    setFamilyId(profileRes.data.family_id);
    setItems(purchasesRes.data);
    setRowStates({});
    setGiveLoading(false);
  }, []);

  useEffect(() => {
    void loadStore();
    void loadGive();
  }, [loadStore, loadGive]);

  // Self-heal on foreground: recover a transient load failure without a re-login.
  useRefetchOnForeground(() => {
    void loadStore();
    void loadGive();
  });

  // Quiet refetch for realtime (#41): refresh the fulfillment queue in place
  // without flashing the section's loading state.
  const reloadGive = useCallback(async () => {
    const { data, error } = await listPurchases(supabase, 'purchased');
    if (!error && data) setItems(data);
  }, []);

  // Realtime (#41): a kid buying a reward lands in the "To give" queue live.
  // Filter by the parent's family_id (RLS also scopes it); subscribe once
  // family_id is known and tear the channel down on cleanup.
  useEffect(() => {
    if (!familyId) return;
    const unsub = subscribeToTable(supabase, {
      table: 'reward_purchases',
      filter: `family_id=eq.${familyId}`,
      onChange: () => void reloadGive(),
    });
    return () => unsub();
  }, [familyId, reloadGive]);

  // --- Store handlers --------------------------------------------------------
  const handleSaved = useCallback(() => {
    setStoreView({ mode: 'list' });
    void loadStore();
  }, [loadStore]);

  const handleDelete = useCallback(async (reward: Reward) => {
    setStoreRowError('');
    const { error } = await deleteReward(supabase, reward.id);
    if (error) {
      setStoreRowError('Could not delete that reward. Try again.');
      return;
    }
    setRewards((prev) => prev.filter((r) => r.id !== reward.id));
  }, []);

  // --- Fulfillment handlers --------------------------------------------------
  const onGive = useCallback(
    async (item: FulfillmentItem) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRowStates((prev) => ({ ...prev, [item.id]: { kind: 'busy' } }));
      const { error } = await markPurchaseGiven(supabase, item.id, reviewerId);
      if (error) {
        setRowStates((prev) => ({
          ...prev,
          [item.id]: { kind: 'error', message: "Couldn't update — tap to retry." },
        }));
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setRowStates((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    },
    [reviewerId, rowStates],
  );

  const closeForm = () => setStoreView({ mode: 'list' });

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      {/* Create/edit reward form as a native page-sheet (smooth slide up/down). */}
      <Modal
        visible={storeView.mode !== 'list'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <View style={tw`flex-1 bg-surface-page`}>
          {storeView.mode === 'create' ? (
            <RewardForm onSaved={handleSaved} onCancel={closeForm} />
          ) : null}
          {storeView.mode === 'edit' ? (
            <RewardForm reward={storeView.reward} onSaved={handleSaved} onCancel={closeForm} />
          ) : null}
        </View>
      </Modal>
      <ScrollView
        contentContainerStyle={tw.style('px-5 pb-6', isRegular ? 'items-center' : '', {
          paddingTop: insets.top + 12,
        })}
      >
        <View style={tw.style('w-full', isRegular ? 'max-w-[860px]' : '')}>
          <Text style={tw`mb-4 font-display text-[28px] font-extrabold text-ink-900`}>Rewards</Text>

          <View style={tw`mb-5 max-w-[420px]`}>
            <Tabs tabs={TABS} value={tab} onChange={(v) => setTab(v as Tab)} />
          </View>

          {tab === 'store' ? (
            <StoreSection
              loading={storeLoading}
              error={storeError}
              rowError={storeRowError}
              rewards={rewards}
              onRetry={loadStore}
              onNew={() => setStoreView({ mode: 'create' })}
              onEdit={(reward) => setStoreView({ mode: 'edit', reward })}
              onDelete={handleDelete}
            />
          ) : (
            <GiveSection
              loading={giveLoading}
              error={giveError}
              items={items}
              rowStates={rowStates}
              onRetry={loadGive}
              onGive={onGive}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// --- Store tab body ----------------------------------------------------------

function StoreSection({
  loading,
  error,
  rowError,
  rewards,
  onRetry,
  onNew,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  error: string;
  rowError: string;
  rewards: Reward[];
  onRetry: () => void;
  onNew: () => void;
  onEdit: (reward: Reward) => void;
  onDelete: (reward: Reward) => Promise<void>;
}) {
  if (loading) {
    return (
      <SectionState>
        <ActivityIndicator size="large" color="#F4720E" />
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>
          Loading rewards…
        </Text>
      </SectionState>
    );
  }

  if (error) {
    return (
      <SectionState>
        <View style={tw`w-full max-w-[420px] gap-4`}>
          <FormError message={error} />
          <Button block onPress={onRetry}>
            Try again
          </Button>
        </View>
      </SectionState>
    );
  }

  if (rewards.length === 0) {
    return (
      <SectionState>
        <Icon name="gift" size={40} color="#A39CAD" />
        <Text style={tw`mt-3 text-center font-display text-[20px] font-extrabold text-ink-900`}>
          No rewards yet
        </Text>
        <Text style={tw`mt-1 mb-6 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          Add something kids can spend their loot on.
        </Text>
        <Button onPress={onNew} accessibilityLabel="New reward">
          ＋ New reward
        </Button>
      </SectionState>
    );
  }

  return (
    <View style={tw`gap-3`}>
      {rowError ? <FormError message={rowError} /> : null}
      <StoreList rewards={rewards} onNew={onNew} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

// --- Give tab body -----------------------------------------------------------

function GiveSection({
  loading,
  error,
  items,
  rowStates,
  onRetry,
  onGive,
}: {
  loading: boolean;
  error: string;
  items: FulfillmentItem[];
  rowStates: Record<string, RowState>;
  onRetry: () => void;
  onGive: (item: FulfillmentItem) => void;
}) {
  if (loading) {
    return (
      <SectionState>
        <ActivityIndicator size="large" color="#F4720E" />
        <Text style={tw`mt-4 font-sans text-[15px] font-semibold text-ink-500`}>
          Loading queue…
        </Text>
      </SectionState>
    );
  }

  if (error) {
    return (
      <SectionState>
        <View style={tw`w-full max-w-[420px] gap-4`}>
          <FormError message={error} />
          <Button block onPress={onRetry}>
            Try again
          </Button>
        </View>
      </SectionState>
    );
  }

  if (items.length === 0) {
    return (
      <SectionState>
        <Icon name="gift" size={44} color="#A39CAD" />
        <Text style={tw`mt-3 text-center font-display text-[20px] font-extrabold text-ink-900`}>
          Nothing to hand out
        </Text>
        <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          Purchased rewards waiting to be given will show up here.
        </Text>
      </SectionState>
    );
  }

  return <FulfillmentList items={items} rowStates={rowStates} onGive={onGive} />;
}

// Centred block for per-section loading / empty / error states. Min height keeps
// the surface from collapsing under the tabs.
function SectionState({ children }: { children: React.ReactNode }) {
  return (
    <View style={tw`min-h-[280px] items-center justify-center py-10`}>{children}</View>
  );
}
