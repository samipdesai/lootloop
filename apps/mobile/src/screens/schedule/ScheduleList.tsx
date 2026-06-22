// Schedule list (#36). Items grouped by kid — a SectionList with one section per
// kid (resolved kid_id → display name), rows ordered by start_time (the service
// already orders by kid then start_time). Each row shows the icon tile, title,
// time range, and a recurrence pill; offers Edit + Delete (inline confirm — no
// blocking Alert.alert). Loading / empty / error states live in the parent
// ScheduleScreen; this renders the populated, sectioned list + the New affordance.
import { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import type { ScheduleItem, KidProfile } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import tw from '../../lib/tw';
import { ScheduleIcon } from './ScheduleIcon';
import { describeDays, formatTimeRange } from './schedule';

interface ScheduleListProps {
  items: ScheduleItem[];
  kidsById: Map<string, KidProfile>;
  onNew: () => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => Promise<void>;
}

interface Section {
  kidId: string;
  title: string;
  data: ScheduleItem[];
}

// Small tonal pill (recurrence / inactive).
function Pill({ children, tone }: { children: string; tone: 'mint' | 'ink' }) {
  const fills = { mint: 'bg-mint-soft', ink: 'bg-ink-100' } as const;
  const inks = { mint: 'text-mint-ink', ink: 'text-ink-700' } as const;
  return (
    <View style={tw.style('rounded-pill px-2.5 py-1', fills[tone])}>
      <Text style={tw.style('font-sans text-[12px] font-extrabold', inks[tone])}>{children}</Text>
    </View>
  );
}

function ScheduleRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inactive = !item.active;

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
        <ScheduleIcon icon={item.icon} muted={inactive} />
        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-center gap-2`}>
            <Text style={tw`flex-1 font-display text-[16px] font-extrabold text-ink-900`}>
              {item.title}
            </Text>
            {inactive ? <Pill tone="ink">Inactive</Pill> : null}
          </View>
          <Text style={tw`mt-1 font-sans text-[13px] font-bold text-ink-700`}>
            {formatTimeRange(item.start_time, item.end_time)}
          </Text>
          <View style={tw`mt-1.5 flex-row flex-wrap items-center gap-1.5`}>
            <Pill tone="mint">{describeDays(item.days_of_week)}</Pill>
          </View>
        </View>
      </View>

      <View style={tw`mt-3 flex-row items-center justify-end gap-2`}>
        {confirming ? (
          <>
            <Text style={tw`mr-auto font-sans text-[13px] font-bold text-ink-700`}>
              Delete this item?
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
              accessibilityLabel={`Delete ${item.title}`}
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

export function ScheduleList({ items, kidsById, onNew, onEdit, onDelete }: ScheduleListProps) {
  const isRegular = useSizeClass() === 'regular';

  // Group items into one section per kid, preserving the service's kid→start_time
  // order. Unknown kid_ids (roster lag) fall under an "Unassigned" section.
  const sections = useMemo<Section[]>(() => {
    const order: string[] = [];
    const byKid = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      if (!byKid.has(item.kid_id)) {
        byKid.set(item.kid_id, []);
        order.push(item.kid_id);
      }
      byKid.get(item.kid_id)!.push(item);
    }
    return order.map((kidId) => ({
      kidId,
      title: kidsById.get(kidId)?.display_name ?? 'Unassigned',
      data: byKid.get(kidId)!,
    }));
  }, [items, kidsById]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style(
        'gap-3 px-5 pb-10 pt-4',
        isRegular ? 'mx-auto w-full max-w-[720px]' : null,
      )}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={tw`mb-1 flex-row items-center justify-between`}>
          <Text style={tw`font-display text-[28px] font-extrabold text-ink-900`}>Schedule</Text>
          <Button size="sm" onPress={onNew} accessibilityLabel="New item">
            ＋ New
          </Button>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={tw`mt-2 font-display text-[15px] font-extrabold uppercase tracking-wide text-ink-500`}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <ScheduleRow item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
      )}
    />
  );
}
