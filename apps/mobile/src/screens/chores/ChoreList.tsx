// Chore list (#13). Scrollable list of chore cards with icon tile, title, points
// badge, assignment indicator (Shared badge / kid name), recurrence label, and
// active state. Each row offers Edit + Delete (inline confirm — no blocking
// Alert.alert). Loading / empty / error states are all handled by the parent
// ChoresScreen; this component renders the populated list + the New affordance.
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Chore, KidProfile } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { ChoreIcon } from './ChoreIcon';
import { describeRecurrence } from './recurrence';

interface ChoreListProps {
  chores: Chore[];
  kidsById: Map<string, KidProfile>;
  onNew: () => void;
  onEdit: (chore: Chore) => void;
  onDelete: (chore: Chore) => Promise<void>;
}

// Small tonal pill (points coin / shared / kid name / recurrence).
function Pill({
  children,
  tone,
}: {
  children: string;
  tone: 'coin' | 'indigo' | 'mint' | 'ink';
}) {
  const fills = {
    coin: 'bg-coin-soft',
    indigo: 'bg-indigo-soft',
    mint: 'bg-mint-soft',
    ink: 'bg-ink-100',
  } as const;
  const inks = {
    coin: 'text-coin-ink',
    indigo: 'text-indigo-ink',
    mint: 'text-mint-ink',
    ink: 'text-ink-700',
  } as const;
  return (
    <View style={tw.style('rounded-pill px-2.5 py-1', fills[tone])}>
      <Text style={tw.style('font-sans text-[12px] font-extrabold', inks[tone])}>{children}</Text>
    </View>
  );
}

function ChoreRow({
  chore,
  kidName,
  onEdit,
  onDelete,
}: {
  chore: Chore;
  kidName: string | null;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inactive = !chore.active;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    // On success the row unmounts; on error the parent surfaces it and the row
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
        <ChoreIcon icon={chore.icon} muted={inactive} />
        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-center gap-2`}>
            <Text style={tw`flex-1 font-display text-[16px] font-extrabold text-ink-900`}>
              {chore.title}
            </Text>
            {inactive ? <Pill tone="ink">Inactive</Pill> : null}
          </View>
          <View style={tw`mt-1.5 flex-row flex-wrap items-center gap-1.5`}>
            <Pill tone="coin">{`${chore.points} pts`}</Pill>
            {chore.assignment === 'shared' ? (
              <Pill tone="indigo">Shared</Pill>
            ) : (
              <Pill tone="mint">{kidName ?? 'Assigned'}</Pill>
            )}
            <Pill tone="ink">{describeRecurrence(chore.recurrence_rule)}</Pill>
          </View>
        </View>
      </View>

      <View style={tw`mt-3 flex-row items-center justify-end gap-2`}>
        {confirming ? (
          <>
            <Text style={tw`mr-auto font-sans text-[13px] font-bold text-ink-700`}>
              Delete this chore?
            </Text>
            <Button
              size="sm"
              variant="ghost"
              disabled={deleting}
              onPress={() => setConfirming(false)}
            >
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
              accessibilityLabel={`Delete ${chore.title}`}
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

export function ChoreList({ chores, kidsById, onNew, onEdit, onDelete }: ChoreListProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      data={chores}
      keyExtractor={(c) => c.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style(
        'gap-3 px-5 pb-10',
        isRegular ? 'mx-auto w-full max-w-[720px]' : null,
        { paddingTop: insets.top + 12 },
      )}
      ListHeaderComponent={
        <View style={tw`mb-1 flex-row items-center justify-between`}>
          <View>
            <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
              Parent
            </Text>
            <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Chores</Text>
          </View>
          <Pressable
            testID="new-chore"
            accessibilityRole="button"
            accessibilityLabel="New chore"
            onPress={onNew}
            style={tw.style('h-10 w-10 items-center justify-center rounded-full bg-indigo', {
              shadowColor: '#444CCB',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 4,
            })}
          >
            <Icon name="plus" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <ChoreRow
          chore={item}
          kidName={item.assigned_kid_id ? (kidsById.get(item.assigned_kid_id)?.display_name ?? null) : null}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      )}
    />
  );
}
