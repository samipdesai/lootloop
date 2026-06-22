// Fulfillment queue (#25). Rows show the reward emoji/title, the kid who bought
// it, the coin cost and how long ago. "Mark as given" flips the purchase to
// 'given' (markPurchaseGiven) and removes the row; per-row busy + inline error
// state mirror the approvals queue. Empty / loading / error states are owned by
// the parent RewardsScreen. Adaptive: compact single column / regular two-up.
import { Text, View } from 'react-native';
import type { FulfillmentItem } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { initial, relativeTime } from './format';

// Per-row request state (mirrors the approvals queue).
export type RowState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string };

interface FulfillmentListProps {
  items: FulfillmentItem[];
  rowStates: Record<string, RowState>;
  onGive: (item: FulfillmentItem) => void;
}

function KidAvatar({ name }: { name: string }) {
  return (
    <View style={tw`h-6 w-6 items-center justify-center rounded-pill bg-indigo-soft`}>
      <Text style={tw`font-display text-[12px] font-extrabold text-indigo-ink`}>
        {initial(name)}
      </Text>
    </View>
  );
}

function FulfillmentRow({
  item,
  state,
  onGive,
}: {
  item: FulfillmentItem;
  state: RowState;
  onGive: () => void;
}) {
  const busy = state.kind === 'busy';

  return (
    <Card>
      <View style={tw`flex-row items-center gap-3`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-md bg-indigo-soft`}>
          <Text style={tw`text-[24px]`}>{item.reward_emoji?.trim() || '🎁'}</Text>
        </View>
        <View style={tw`flex-1`}>
          <Text
            numberOfLines={1}
            style={tw`font-display text-[16px] font-extrabold text-ink-900`}
          >
            {item.reward_title || 'Reward'}
          </Text>
          <View style={tw`mt-1 flex-row items-center gap-2`}>
            <KidAvatar name={item.kid_display_name} />
            <Text numberOfLines={1} style={tw`font-sans text-[13px] font-bold text-ink-500`}>
              {item.kid_display_name || 'Kid'} · {relativeTime(item.purchased_at)}
            </Text>
          </View>
        </View>
        <CoinBadge amount={item.cost} size="sm" tone="soft" />
      </View>

      <View style={tw`mt-3`}>
        <Button
          block
          size="sm"
          loading={busy}
          disabled={busy}
          onPress={onGive}
          accessibilityLabel={`Mark ${item.reward_title} for ${item.kid_display_name} as given`}
        >
          {busy ? 'Working' : 'Mark as given'}
        </Button>
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

export function FulfillmentList({ items, rowStates, onGive }: FulfillmentListProps) {
  const isRegular = useSizeClass() === 'regular';

  return (
    <View style={tw`gap-3`}>
      <Text style={tw`font-sans text-[15px] font-bold text-ink-500`}>
        {items.length} to hand out
      </Text>
      <View style={tw.style('flex-row flex-wrap', isRegular ? '-mx-1.5' : '')}>
        {items.map((item) => (
          <View key={item.id} style={tw.style(isRegular ? 'w-1/2 px-1.5 pb-3' : 'w-full pb-3')}>
            <FulfillmentRow
              item={item}
              state={rowStates[item.id] ?? { kind: 'idle' }}
              onGive={() => onGive(item)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
