// Parent Approval Queue (#17) + award wiring (#18) + reading approval (#28),
// mobile parent surface. Self-contained: loads the reviewer profile + both
// pending queues (chore completions, reading logs) on mount via the supabase
// singleton, splits them with a Chores / Reading segmented control, and
// approves/rejects each inline.
//
// Chores: approve awards the chore's fixed points (award_points_on_approval RPC).
// Reading: approve awards parent-chosen points — the row reveals a small numeric
// field (default 10, integer > 0) before calling approve_reading_log (#28/#29).
//
// Adaptive (one component tree, branched on useSizeClass):
//   compact (iPhone) -> single column, full-width rows.
//   regular (iPad)   -> centered max-width column, two-up grid of rows.
//
// No Alert.alert (blocks the JS bridge) — errors render inline as banners.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  approveCompletion,
  approveReadingLog,
  getMyParentProfile,
  listPendingCompletions,
  listPendingReadingLogs,
  rejectCompletion,
  rejectReadingLog,
  subscribeToTable,
  type PendingCompletion,
  type PendingReadingLog,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Icon } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { initial, readDate, relativeTime } from './format';

// Inline confirmation shown briefly after an approve/reject resolves.
interface Toast {
  id: string;
  tone: 'mint' | 'ink';
  message: string;
}

// Per-row request state.
type RowState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string };

type TabValue = 'chores' | 'reading';

const TABS = [
  { value: 'chores', label: 'Chores' },
  { value: 'reading', label: 'Reading' },
];

const DEFAULT_READING_POINTS = 10;

export function ApprovalsScreen() {
  const sizeClass = useSizeClass();
  const isRegular = sizeClass === 'regular';
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabValue>('chores');

  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [chores, setChores] = useState<PendingCompletion[]>([]);
  const [reads, setReads] = useState<PendingReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [profileRes, choresRes, readsRes] = await Promise.all([
      getMyParentProfile(supabase),
      listPendingCompletions(supabase),
      listPendingReadingLogs(supabase),
    ]);

    if (profileRes.error || !profileRes.data) {
      setLoadError("We couldn't load your account. Pull to retry.");
      setLoading(false);
      return;
    }
    if (choresRes.error || !choresRes.data) {
      setLoadError("We couldn't load the approval queue. Tap retry.");
      setLoading(false);
      return;
    }
    if (readsRes.error || !readsRes.data) {
      setLoadError("We couldn't load the approval queue. Tap retry.");
      setLoading(false);
      return;
    }

    setReviewerId(profileRes.data.id);
    setFamilyId(profileRes.data.family_id);
    setChores(choresRes.data);
    setReads(readsRes.data);
    setRowStates({});
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Quiet refetches for realtime (#41): refresh a queue in place without flashing
  // the full-screen loading state. Used by the live subscriptions below.
  const reloadChores = useCallback(async () => {
    const { data, error } = await listPendingCompletions(supabase);
    if (!error && data) setChores(data);
  }, []);

  const reloadReads = useCallback(async () => {
    const { data, error } = await listPendingReadingLogs(supabase);
    if (!error && data) setReads(data);
  }, []);

  // Realtime (#41): a kid completing a chore / logging reading lands in the queue
  // live. Filter by the parent's family_id (RLS also scopes it); subscribe once
  // family_id is known and tear the channels down on cleanup.
  useEffect(() => {
    if (!familyId) return;
    const unsubs = [
      subscribeToTable(supabase, {
        table: 'chore_completions',
        filter: `family_id=eq.${familyId}`,
        onChange: () => void reloadChores(),
      }),
      subscribeToTable(supabase, {
        table: 'reading_logs',
        filter: `family_id=eq.${familyId}`,
        onChange: () => void reloadReads(),
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [familyId, reloadChores, reloadReads]);

  const setRow = useCallback((id: string, state: RowState) => {
    setRowStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const clearRow = useCallback((id: string) => {
    setRowStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const pushToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3200);
  }, []);

  // --- Chores ---------------------------------------------------------------

  const onApproveChore = useCallback(
    async (item: PendingCompletion) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await approveCompletion(supabase, item.id, reviewerId);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't approve — tap to retry." });
        return;
      }
      setChores((prev) => prev.filter((c) => c.id !== item.id));
      clearRow(item.id);
      pushToast({
        id: `${item.id}-approve`,
        tone: 'mint',
        message: `+${item.points} points to ${item.kid_display_name || 'kid'}`,
      });
    },
    [reviewerId, rowStates, setRow, clearRow, pushToast],
  );

  const onRejectChore = useCallback(
    async (item: PendingCompletion) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await rejectCompletion(supabase, item.id, reviewerId);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't reject — tap to retry." });
        return;
      }
      setChores((prev) => prev.filter((c) => c.id !== item.id));
      clearRow(item.id);
      pushToast({
        id: `${item.id}-reject`,
        tone: 'ink',
        message: `Sent back to ${item.kid_display_name || 'kid'}`,
      });
    },
    [reviewerId, rowStates, setRow, clearRow, pushToast],
  );

  // --- Reading --------------------------------------------------------------

  const onApproveReading = useCallback(
    async (item: PendingReadingLog, points: number) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await approveReadingLog(supabase, item.id, reviewerId, points);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't approve — tap to retry." });
        return;
      }
      setReads((prev) => prev.filter((r) => r.id !== item.id));
      clearRow(item.id);
      pushToast({
        id: `${item.id}-approve`,
        tone: 'mint',
        message: `+${points} to ${item.kid_display_name || 'kid'} for reading`,
      });
    },
    [reviewerId, rowStates, setRow, clearRow, pushToast],
  );

  const onRejectReading = useCallback(
    async (item: PendingReadingLog) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await rejectReadingLog(supabase, item.id, reviewerId);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't reject — tap to retry." });
        return;
      }
      setReads((prev) => prev.filter((r) => r.id !== item.id));
      clearRow(item.id);
      pushToast({
        id: `${item.id}-reject`,
        tone: 'ink',
        message: `Sent back to ${item.kid_display_name || 'kid'}`,
      });
    },
    [reviewerId, rowStates, setRow, clearRow, pushToast],
  );

  const total = chores.length + reads.length;
  const activeCount = tab === 'chores' ? chores.length : reads.length;

  // --- States ---------------------------------------------------------------

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#F4720E" size="large" />
        <Text style={tw`mt-3 font-sans text-[15px] font-bold text-ink-500`}>
          Loading approvals…
        </Text>
      </Centered>
    );
  }

  if (loadError) {
    return (
      <Centered>
        <Text style={tw`text-[40px]`}>😕</Text>
        <Text style={tw`mt-2 text-center font-display text-[20px] font-extrabold text-ink-900`}>
          Something went wrong
        </Text>
        <Text style={tw`mt-1 mb-5 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          {loadError}
        </Text>
        <Button onPress={load} accessibilityLabel="Retry loading approvals">
          Retry
        </Button>
      </Centered>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <ScrollView
        contentContainerStyle={tw.style('px-5 pb-6', isRegular ? 'items-center' : '', {
          paddingTop: insets.top + 12,
        })}
      >
        <View style={tw.style('w-full', isRegular ? 'max-w-[860px]' : '')}>
          <View style={tw`mb-1 flex-row items-center gap-2.5`}>
            <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Approvals</Text>
            {total > 0 ? (
              <View style={tw`h-6 min-w-6 items-center justify-center rounded-pill bg-orange px-2`}>
                <Text style={tw`font-display text-[14px] font-extrabold text-white`}>{total}</Text>
              </View>
            ) : null}
          </View>
          <Text style={tw`mb-4 font-sans text-[15px] font-semibold text-ink-500`}>
            {total} waiting for review
          </Text>

          <View style={tw`mb-5`}>
            <Tabs tabs={TABS} value={tab} onChange={(v) => setTab(v as TabValue)} />
          </View>

          {activeCount === 0 ? (
            <EmptyQueue tab={tab} />
          ) : (
            <View style={tw.style('flex-row flex-wrap', isRegular ? '-mx-2' : '')}>
              {tab === 'chores'
                ? chores.map((item) => (
                    <View
                      key={item.id}
                      style={tw.style(isRegular ? 'w-1/2 px-2 pb-4' : 'w-full pb-3')}
                    >
                      <ChoreRow
                        item={item}
                        state={rowStates[item.id] ?? { kind: 'idle' }}
                        onApprove={() => onApproveChore(item)}
                        onReject={() => onRejectChore(item)}
                      />
                    </View>
                  ))
                : reads.map((item) => (
                    <View
                      key={item.id}
                      style={tw.style(isRegular ? 'w-1/2 px-2 pb-4' : 'w-full pb-3')}
                    >
                      <ReadingRow
                        item={item}
                        state={rowStates[item.id] ?? { kind: 'idle' }}
                        onApprove={(points) => onApproveReading(item, points)}
                        onReject={() => onRejectReading(item)}
                      />
                    </View>
                  ))}
            </View>
          )}
        </View>
      </ScrollView>
      <ToastStack toasts={toasts} />
    </View>
  );
}

// --- Chore row ---------------------------------------------------------------

function ChoreRow({
  item,
  state,
  onApprove,
  onReject,
}: {
  item: PendingCompletion;
  state: RowState;
  onApprove: () => void;
  onReject: () => void;
}) {
  const busy = state.kind === 'busy';

  return (
    <Card>
      <View style={tw`flex-row items-center gap-3`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-md bg-coin-soft`}>
          <Icon name="circle-check-big" size={22} color="#8A6400" />
        </View>
        <View style={tw`flex-1`}>
          <Text
            numberOfLines={1}
            style={tw`font-display text-[16px] font-extrabold text-ink-900`}
          >
            {item.chore_title || 'Chore'}
          </Text>
          <View style={tw`mt-1 flex-row items-center gap-2`}>
            <KidAvatar name={item.kid_display_name} />
            <Text numberOfLines={1} style={tw`font-sans text-[13px] font-bold text-ink-500`}>
              {item.kid_display_name || 'Kid'} · {relativeTime(item.submitted_at)}
            </Text>
          </View>
        </View>
        <CoinBadge amount={item.points} size="sm" tone="soft" />
      </View>

      <View style={tw`mt-3 flex-row items-center gap-3`}>
        <View style={tw`flex-1`}>
          <Button
            block
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={onReject}
            accessibilityLabel={`Reject ${item.chore_title} from ${item.kid_display_name}`}
          >
            Reject
          </Button>
        </View>
        <View style={tw`flex-1`}>
          <Button
            block
            size="sm"
            loading={busy}
            disabled={busy}
            onPress={onApprove}
            accessibilityLabel={`Approve ${item.chore_title} and award ${item.points} points to ${item.kid_display_name}`}
          >
            {busy ? 'Working' : 'Approve'}
          </Button>
        </View>
      </View>

      <RowError state={state} />
    </Card>
  );
}

// --- Reading row -------------------------------------------------------------

function ReadingRow({
  item,
  state,
  onApprove,
  onReject,
}: {
  item: PendingReadingLog;
  state: RowState;
  onApprove: (points: number) => void;
  onReject: () => void;
}) {
  const busy = state.kind === 'busy';

  // The points field only appears once the parent taps Approve, so the resting
  // row stays compact. `raw` is the text buffer; `points` is the parsed integer.
  const [awarding, setAwarding] = useState(false);
  const [raw, setRaw] = useState(String(DEFAULT_READING_POINTS));

  const points = useMemo(() => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [raw]);
  const validPoints = Number.isInteger(points) && points > 0;

  const onChangePoints = (text: string) => {
    // Digits only — keeps the number-pad input a clean positive integer.
    setRaw(text.replace(/[^0-9]/g, ''));
  };

  return (
    <Card>
      <View style={tw`flex-row items-center gap-3`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-md bg-indigo-soft`}>
          <Icon name="book-open" size={22} color="#444CCB" />
        </View>
        <View style={tw`flex-1`}>
          <Text
            numberOfLines={1}
            style={tw`font-display text-[16px] font-extrabold text-ink-900`}
          >
            {item.book_title || 'Reading'}
          </Text>
          <View style={tw`mt-1 flex-row items-center gap-2`}>
            <KidAvatar name={item.kid_display_name} />
            <Text numberOfLines={1} style={tw`font-sans text-[13px] font-bold text-ink-500`}>
              {item.kid_display_name || 'Kid'} · {item.minutes} min · {readDate(item.read_on)}
            </Text>
          </View>
        </View>
      </View>

      {awarding ? (
        <View style={tw`mt-3 gap-3`}>
          <View style={tw`flex-row items-end gap-3`}>
            <View style={tw`w-24`}>
              <Input
                label="Points"
                value={raw}
                onChangeText={onChangePoints}
                keyboardType="number-pad"
                maxLength={4}
                editable={!busy}
                accessibilityLabel={`Points to award ${item.kid_display_name} for reading`}
                error={validPoints ? undefined : 'Enter a number'}
              />
            </View>
            <View style={tw`flex-1 flex-row gap-3`}>
              <View style={tw`flex-1`}>
                <Button
                  block
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={() => setAwarding(false)}
                  accessibilityLabel="Cancel awarding points"
                >
                  Cancel
                </Button>
              </View>
              <View style={tw`flex-1`}>
                <Button
                  block
                  size="sm"
                  loading={busy}
                  disabled={busy || !validPoints}
                  onPress={() => onApprove(points)}
                  accessibilityLabel={`Award ${validPoints ? points : ''} points to ${item.kid_display_name} for reading`}
                >
                  {busy ? 'Working' : 'Award'}
                </Button>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={tw`mt-3 flex-row items-center gap-3`}>
          <View style={tw`flex-1`}>
            <Button
              block
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={onReject}
              accessibilityLabel={`Reject reading "${item.book_title}" from ${item.kid_display_name}`}
            >
              Reject
            </Button>
          </View>
          <View style={tw`flex-1`}>
            <Button
              block
              size="sm"
              disabled={busy}
              onPress={() => setAwarding(true)}
              accessibilityLabel={`Approve reading "${item.book_title}" from ${item.kid_display_name}`}
            >
              Approve
            </Button>
          </View>
        </View>
      )}

      <RowError state={state} />
    </Card>
  );
}

// --- Shared bits -------------------------------------------------------------

function RowError({ state }: { state: RowState }) {
  if (state.kind !== 'error') return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={tw`mt-3 flex-row items-center gap-2 rounded-md bg-danger-soft px-3 py-2`}
    >
      <Text style={tw`text-[13px]`}>⚠️</Text>
      <Text style={tw`flex-1 font-sans text-[13px] font-bold text-danger-ink`}>
        {state.message}
      </Text>
    </View>
  );
}

function EmptyQueue({ tab }: { tab: TabValue }) {
  const reading = tab === 'reading';
  return (
    <View style={tw`items-center px-4 py-12`}>
      <Icon name={reading ? 'book-open' : 'circle-check-big'} size={44} color="#A39CAD" />
      <Text style={tw`mt-3 text-center font-display text-[22px] font-extrabold text-ink-900`}>
        {reading ? 'No reading entries waiting' : 'All caught up'}
      </Text>
      <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
        {reading ? 'Reading logs to review will show up here.' : 'Nothing to approve right now.'}
      </Text>
    </View>
  );
}

// Initial-letter avatar. Photo avatars (kid_avatar_url) land in a later polish
// pass (image source + signed URL); the initial fallback keeps rows non-blank.
function KidAvatar({ name }: { name: string }) {
  return (
    <View style={tw`h-6 w-6 items-center justify-center rounded-pill bg-indigo-soft`}>
      <Text style={tw`font-display text-[12px] font-extrabold text-indigo-ink`}>
        {initial(name)}
      </Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={tw`flex-1 items-center justify-center bg-surface-page px-8`}>
      {children}
    </View>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={tw`absolute inset-x-0 bottom-6 items-center gap-2 px-5`}
    >
      {toasts.map((t) => (
        <View
          key={t.id}
          accessibilityLiveRegion="polite"
          style={tw.style(
            'flex-row items-center gap-2 rounded-pill px-5 py-3',
            t.tone === 'mint' ? 'bg-mint' : 'bg-ink-800',
          )}
        >
          <Icon name={t.tone === 'mint' ? 'check' : 'repeat'} size={15} color="#FFFFFF" />
          <Text style={tw`font-display text-[14px] font-bold text-white`}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}
