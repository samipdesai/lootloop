// Parent Approval Queue (#17) + award wiring (#18), mobile parent surface.
// Self-contained: loads the reviewer profile + pending completions on mount via
// the supabase singleton, lists them, and approves/rejects each inline. The
// approve path calls the atomic award_points_on_approval RPC (#18).
//
// Adaptive (one component tree, branched on useSizeClass):
//   compact (iPhone) -> single column, full-width rows.
//   regular (iPad)   -> centered max-width column, two-up grid of rows.
//
// No Alert.alert (blocks the JS bridge) — errors render inline as banners.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import {
  approveCompletion,
  getMyParentProfile,
  listPendingCompletions,
  rejectCompletion,
  type PendingCompletion,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import tw from '../../lib/tw';
import { initial, relativeTime } from './format';

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

export function ApprovalsScreen() {
  const sizeClass = useSizeClass();
  const isRegular = sizeClass === 'regular';

  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [items, setItems] = useState<PendingCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [profileRes, pendingRes] = await Promise.all([
      getMyParentProfile(supabase),
      listPendingCompletions(supabase),
    ]);

    if (profileRes.error || !profileRes.data) {
      setLoadError("We couldn't load your account. Pull to retry.");
      setLoading(false);
      return;
    }
    if (pendingRes.error || !pendingRes.data) {
      setLoadError("We couldn't load the approval queue. Tap retry.");
      setLoading(false);
      return;
    }

    setReviewerId(profileRes.data.id);
    setItems(pendingRes.data);
    setRowStates({});
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRow = useCallback((id: string, state: RowState) => {
    setRowStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
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

  const onApprove = useCallback(
    async (item: PendingCompletion) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await approveCompletion(supabase, item.id, reviewerId);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't approve — tap to retry." });
        return;
      }
      removeItem(item.id);
      pushToast({
        id: `${item.id}-approve`,
        tone: 'mint',
        message: `+${item.points} points to ${item.kid_display_name || 'kid'}`,
      });
    },
    [reviewerId, rowStates, setRow, removeItem, pushToast],
  );

  const onReject = useCallback(
    async (item: PendingCompletion) => {
      if (!reviewerId) return;
      if (rowStates[item.id]?.kind === 'busy') return;
      setRow(item.id, { kind: 'busy' });
      const { error } = await rejectCompletion(supabase, item.id, reviewerId);
      if (error) {
        setRow(item.id, { kind: 'error', message: "Couldn't reject — tap to retry." });
        return;
      }
      removeItem(item.id);
      pushToast({
        id: `${item.id}-reject`,
        tone: 'ink',
        message: `Sent back to ${item.kid_display_name || 'kid'}`,
      });
    },
    [reviewerId, rowStates, setRow, removeItem, pushToast],
  );

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

  if (items.length === 0) {
    return (
      <Centered>
        <Text style={tw`text-[44px]`}>🎉</Text>
        <Text style={tw`mt-3 text-center font-display text-[22px] font-extrabold text-ink-900`}>
          All caught up
        </Text>
        <Text style={tw`mt-1 text-center font-sans text-[15px] font-semibold text-ink-500`}>
          Nothing to approve right now.
        </Text>
        <ToastStack toasts={toasts} />
      </Centered>
    );
  }

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <ScrollView
        contentContainerStyle={tw.style(
          'px-5 py-6',
          isRegular ? 'items-center' : '',
        )}
      >
        <View style={tw.style('w-full', isRegular ? 'max-w-[860px]' : '')}>
          <Text style={tw`mb-1 font-display text-[26px] font-extrabold text-ink-900`}>
            Approvals
          </Text>
          <Text style={tw`mb-5 font-sans text-[15px] font-semibold text-ink-500`}>
            {items.length} waiting for review
          </Text>

          <View style={tw.style('flex-row flex-wrap', isRegular ? '-mx-2' : '')}>
            {items.map((item) => (
              <View
                key={item.id}
                style={tw.style(isRegular ? 'w-1/2 px-2 pb-4' : 'w-full pb-3')}
              >
                <ApprovalRow
                  item={item}
                  state={rowStates[item.id] ?? { kind: 'idle' }}
                  onApprove={() => onApprove(item)}
                  onReject={() => onReject(item)}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <ToastStack toasts={toasts} />
    </View>
  );
}

// --- Row ---------------------------------------------------------------------

function ApprovalRow({
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
        <View
          style={tw`h-12 w-12 items-center justify-center rounded-md bg-coin-soft`}
        >
          <Text style={tw`text-[22px]`}>{item.chore_icon ?? '✅'}</Text>
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
        <View
          style={tw`flex-row items-center gap-1 rounded-pill bg-coin-soft px-3 py-1.5`}
        >
          <Text style={tw`text-[13px]`}>🪙</Text>
          <Text style={tw`font-number text-[15px] font-extrabold text-coin-ink`}>
            {item.points}
          </Text>
        </View>
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

      {state.kind === 'error' ? (
        <View
          accessibilityLiveRegion="polite"
          style={tw`mt-3 flex-row items-center gap-2 rounded-md bg-danger-soft px-3 py-2`}
        >
          <Text style={tw`text-[13px]`}>⚠️</Text>
          <Text style={tw`flex-1 font-sans text-[13px] font-bold text-danger-ink`}>
            {state.message}
          </Text>
        </View>
      ) : null}
    </Card>
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

// --- Shared shells -----------------------------------------------------------

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
          <Text style={tw`text-[14px]`}>{t.tone === 'mint' ? '🪙' : '↩️'}</Text>
          <Text style={tw`font-display text-[14px] font-bold text-white`}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}
