// Reward store catalog (#22). Cards show the emoji tile, name, coin cost and
// active state. Each card offers Edit + Delete (inline confirm — no blocking
// Alert.alert). Loading / empty / error states are handled by the parent
// RewardsScreen; this renders the populated grid + the New affordance. Adaptive:
// compact (iPhone) single column / regular (iPad) two-up via useSizeClass.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Reward } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';

interface StoreListProps {
  rewards: Reward[];
  onNew: () => void;
  onEdit: (reward: Reward) => void;
  onDelete: (reward: Reward) => Promise<void>;
}

function RewardCard({
  reward,
  onEdit,
  onDelete,
}: {
  reward: Reward;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inactive = !reward.active;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    // On success the card unmounts; on error the parent surfaces it and the card
    // stays — reset so the user can retry.
    setDeleting(false);
    setConfirming(false);
  };

  return (
    <View
      style={tw.style(
        'rounded-card bg-surface-card p-4',
        inactive ? 'opacity-60' : null,
        {
          shadowColor: 'rgba(32,36,58,1)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        },
      )}
    >
      <View style={tw`flex-row items-center gap-3`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-md bg-indigo-soft`}>
          <Text style={tw`text-[24px]`}>{reward.emoji?.trim() || '🎁'}</Text>
        </View>
        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-center gap-2`}>
            <Text
              numberOfLines={1}
              style={tw`flex-1 font-display text-[16px] font-extrabold text-ink-900`}
            >
              {reward.title}
            </Text>
            {inactive ? (
              <View style={tw`rounded-pill bg-ink-100 px-2.5 py-1`}>
                <Text style={tw`font-sans text-[12px] font-extrabold text-ink-700`}>Hidden</Text>
              </View>
            ) : null}
          </View>
          <View style={tw`mt-1.5`}>
            <CoinBadge amount={reward.cost} size="sm" tone="soft" />
          </View>
        </View>
      </View>

      <View style={tw`mt-3 flex-row items-center justify-end gap-2`}>
        {confirming ? (
          <>
            <Text style={tw`mr-auto font-sans text-[13px] font-bold text-ink-700`}>
              Delete this reward?
            </Text>
            <Button size="sm" variant="ghost" disabled={deleting} onPress={() => setConfirming(false)}>
              Keep
            </Button>
            <Button size="sm" loading={deleting} onPress={handleDelete}>
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onPress={onEdit}>
              Edit
            </Button>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${reward.title}`}
              hitSlop={8}
              onPress={() => setConfirming(true)}
              style={tw`rounded-pill px-4 py-2`}
            >
              <Text style={tw`font-display text-[14px] font-bold text-danger-ink`}>Delete</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export function StoreList({ rewards, onNew, onEdit, onDelete }: StoreListProps) {
  const isRegular = useSizeClass() === 'regular';

  return (
    <View style={tw`gap-3`}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={tw`font-sans text-[15px] font-bold text-ink-500`}>
          {rewards.length} {rewards.length === 1 ? 'reward' : 'rewards'}
        </Text>
        <Button size="sm" onPress={onNew} accessibilityLabel="New reward">
          ＋ New reward
        </Button>
      </View>

      <View style={tw.style('flex-row flex-wrap', isRegular ? '-mx-1.5' : '')}>
        {rewards.map((reward) => (
          <View key={reward.id} style={tw.style(isRegular ? 'w-1/2 px-1.5 pb-3' : 'w-full pb-3')}>
            <RewardCard
              reward={reward}
              onEdit={() => onEdit(reward)}
              onDelete={() => onDelete(reward)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
