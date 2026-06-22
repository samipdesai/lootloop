// Kid roster (#15). Scrollable list of kid cards: avatar/initial, name, age-mode
// badge, and per-row Edit / Change PIN / Delete (inline confirm — no blocking
// Alert.alert). The family device-code panel rides in the list header. Loading /
// empty / error states are handled by the parent KidsScreen; this renders the
// populated roster + the New affordance. One component tree; the regular (iPad)
// size class centres the column and widens it.
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { KidProfile } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { ageModeBadge } from './ageMode';
import { FamilyCodePanel } from './FamilyCodePanel';

interface KidListProps {
  kids: KidProfile[];
  onNew: () => void;
  onEdit: (kid: KidProfile) => void;
  onChangePin: (kid: KidProfile) => void;
  onGiveBonus: (kid: KidProfile) => void;
  onHistory: (kid: KidProfile) => void;
  onDelete: (kid: KidProfile) => Promise<void>;
}

function Avatar({ kid }: { kid: KidProfile }) {
  const initial = kid.display_name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={tw`h-12 w-12 items-center justify-center rounded-pill bg-mint-soft`}>
      <Text style={tw`font-display text-[20px] font-extrabold text-mint-ink`}>{initial}</Text>
    </View>
  );
}

function KidRow({
  kid,
  onEdit,
  onChangePin,
  onGiveBonus,
  onHistory,
  onDelete,
}: {
  kid: KidProfile;
  onEdit: () => void;
  onChangePin: () => void;
  onGiveBonus: () => void;
  onHistory: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      style={tw.style('rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      <View style={tw`flex-row items-center gap-3`}>
        <Avatar kid={kid} />
        <View style={tw`flex-1`}>
          <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>
            {kid.display_name}
          </Text>
          <View style={tw`mt-1.5 flex-row`}>
            <View style={tw`rounded-pill bg-indigo-soft px-2.5 py-1`}>
              <Text style={tw`font-sans text-[12px] font-extrabold text-indigo-ink`}>
                {ageModeBadge(kid.age_mode)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={tw`mt-3 flex-row flex-wrap items-center justify-end gap-2`}>
        {confirming ? (
          <>
            <Text style={tw`mr-auto font-sans text-[13px] font-bold text-ink-700`}>
              Delete {kid.display_name}?
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
            <Button size="sm" variant="ghost" onPress={onGiveBonus}>
              Give bonus
            </Button>
            <Button size="sm" variant="ghost" onPress={onHistory}>
              History
            </Button>
            <Button size="sm" variant="ghost" onPress={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onPress={onChangePin}>
              Change PIN
            </Button>
            <Button
              size="sm"
              variant="ghost"
              accessibilityLabel={`Delete ${kid.display_name}`}
              onPress={() => setConfirming(true)}
            >
              Delete
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

export function KidList({
  kids,
  onNew,
  onEdit,
  onChangePin,
  onGiveBonus,
  onHistory,
  onDelete,
}: KidListProps) {
  const isRegular = useSizeClass() === 'regular';

  return (
    <FlatList
      data={kids}
      keyExtractor={(k) => k.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style(
        'gap-3 px-5 pb-10 pt-4',
        isRegular ? 'mx-auto w-full max-w-[720px]' : null,
      )}
      ListHeaderComponent={
        <View style={tw`mb-1 gap-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View>
              <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
                Parent
              </Text>
              <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Kids</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New kid"
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
          <FamilyCodePanel />
        </View>
      }
      renderItem={({ item }) => (
        <KidRow
          kid={item}
          onEdit={() => onEdit(item)}
          onChangePin={() => onChangePin(item)}
          onGiveBonus={() => onGiveBonus(item)}
          onHistory={() => onHistory(item)}
          onDelete={() => onDelete(item)}
        />
      )}
    />
  );
}
