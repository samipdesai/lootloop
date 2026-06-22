// Kid roster (#15). Scrollable list of kid cards: avatar/initial, name, age-mode
// badge, and per-row Edit / Change PIN / Delete (inline confirm — no blocking
// Alert.alert). The family device-code panel rides in the list header. Loading /
// empty / error states are handled by the parent KidsScreen; this renders the
// populated roster + the New affordance. One component tree; the regular (iPad)
// size class centres the column and widens it.
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { KidProfile } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { ageModeBadge } from './ageMode';
// (FamilyCodePanel moved to the Settings → Family code screen.)

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

// One labeled icon action in the card's action row.
function ActionButton({
  icon,
  label,
  tint,
  fg,
  onPress,
}: {
  icon: IconName;
  label: string;
  tint: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={tw`flex-1 items-center gap-1.5`}
    >
      <View style={tw.style(`h-11 w-11 items-center justify-center rounded-full ${tint}`)}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <Text style={tw`font-sans text-[11px] font-bold text-ink-500`}>{label}</Text>
    </Pressable>
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
      style={tw.style('gap-3.5 rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      {/* Header: avatar + name + age band */}
      <View style={tw`flex-row items-center gap-3`}>
        <Avatar kid={kid} />
        <View style={tw`min-w-0 flex-1`}>
          <Text numberOfLines={1} style={tw`font-display text-[17px] font-extrabold text-ink-900`}>
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

      <View style={tw`h-px bg-ink-100`} />

      {confirming ? (
        <View style={tw`gap-3`}>
          <Text style={tw`font-sans text-[14px] font-bold text-ink-700`}>
            Remove {kid.display_name}? This deletes their profile and history.
          </Text>
          <View style={tw`flex-row gap-3`}>
            <Button size="sm" variant="ghost" block disabled={deleting} onPress={() => setConfirming(false)}>
              Keep
            </Button>
            <Button size="sm" block loading={deleting} onPress={handleDelete}>
              Remove
            </Button>
          </View>
        </View>
      ) : (
        // Evenly-spaced labeled icon actions (each opens its modal).
        <View style={tw`flex-row items-start`}>
          <ActionButton icon="star" label="Bonus" tint="bg-coin-soft" fg="#8A6400" onPress={onGiveBonus} />
          <ActionButton icon="clock" label="History" tint="bg-indigo-soft" fg="#5B63E6" onPress={onHistory} />
          <ActionButton icon="pencil" label="Edit" tint="bg-indigo-soft" fg="#5B63E6" onPress={onEdit} />
          <ActionButton icon="lock" label="PIN" tint="bg-indigo-soft" fg="#5B63E6" onPress={onChangePin} />
          <ActionButton icon="trash-2" label="Remove" tint="bg-danger-soft" fg="#B11216" onPress={() => setConfirming(true)} />
        </View>
      )}
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canBack = navigation.canGoBack();

  return (
    <FlatList
      data={kids}
      keyExtractor={(k) => k.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style(
        'gap-3 px-5 pb-10',
        isRegular ? 'mx-auto w-full max-w-[720px]' : null,
        { paddingTop: insets.top + 12 },
      )}
      ListHeaderComponent={
        <View style={tw`mb-1 gap-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              {canBack ? (
                <Pressable
                  testID="parent-back"
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={() => navigation.goBack()}
                  hitSlop={8}
                  style={tw`h-10 w-10 items-center justify-center rounded-full bg-surface-card`}
                >
                  <Icon name="chevron-left" size={22} color="#211E27" />
                </Pressable>
              ) : null}
              <View>
                <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
                  Parent
                </Text>
                <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Kids</Text>
              </View>
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
