// Per-kid actions sheet (#15) — a bottom-sheet modal opened by tapping a kid in
// the roster. Shows the kid (avatar + name + age band) over a tidy action list:
// Give bonus / History / Change PIN / Edit / Remove (inline delete confirm).
// The scrim is a sibling behind the sheet so the action rows tap cleanly.
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { KidProfile } from '@lootloop/client';
import { Icon, type IconName } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { ageModeBadge } from './ageMode';

function ActionRow({
  testID,
  icon,
  label,
  color = '#211E27',
  iconColor,
  onPress,
}: {
  testID?: string;
  icon: IconName;
  label: string;
  color?: string;
  iconColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={tw`flex-row items-center gap-3 rounded-md px-3 py-3.5`}
    >
      <Icon name={icon} size={22} color={iconColor ?? color} />
      <Text style={tw.style('font-display text-[16px] font-extrabold', { color })}>{label}</Text>
    </Pressable>
  );
}

export function KidActionsSheet({
  kid,
  onClose,
  onGiveBonus,
  onHistory,
  onChangePin,
  onEdit,
  onDelete,
}: {
  kid: KidProfile;
  onClose: () => void;
  onGiveBonus: () => void;
  onHistory: () => void;
  onChangePin: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initial = kid.display_name.trim().charAt(0).toUpperCase() || '?';

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    // On success the parent closes the sheet; on error it surfaces a banner and
    // the sheet stays — reset so the user can retry.
    setDeleting(false);
    setConfirming(false);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end`}>
        <Pressable
          accessibilityLabel="Close"
          style={tw.style('absolute inset-0', { backgroundColor: 'rgba(33,30,39,0.5)' })}
          onPress={onClose}
        />
        <View
          style={tw.style('gap-1 rounded-t-2xl bg-surface-card px-4 pt-3', {
            paddingBottom: insets.bottom + 12,
          })}
        >
          {/* Grab handle */}
          <View style={tw`mb-1 self-center h-1 w-10 rounded-pill bg-ink-200`} />

          {/* Kid header */}
          <View style={tw`flex-row items-center gap-3 px-1 pb-2`}>
            <View style={tw`h-12 w-12 items-center justify-center rounded-pill bg-mint-soft`}>
              <Text style={tw`font-display text-[20px] font-extrabold text-mint-ink`}>{initial}</Text>
            </View>
            <View style={tw`min-w-0 flex-1`}>
              <Text numberOfLines={1} style={tw`font-display text-[18px] font-extrabold text-ink-900`}>
                {kid.display_name}
              </Text>
              <Text style={tw`font-sans text-[13px] font-bold text-ink-400`}>
                {ageModeBadge(kid.age_mode)}
              </Text>
            </View>
          </View>

          <View style={tw`h-px bg-ink-100`} />

          {confirming ? (
            <View style={tw`gap-3 px-2 py-4`}>
              <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>
                Remove {kid.display_name}?
              </Text>
              <Text style={tw`font-sans text-[14px] font-semibold text-ink-500`}>
                This deletes their profile, points, and history. This can&apos;t be undone.
              </Text>
              <View style={tw`mt-1 flex-row gap-3`}>
                <Pressable
                  onPress={() => setConfirming(false)}
                  disabled={deleting}
                  style={tw`flex-1 items-center justify-center rounded-pill bg-ink-100 py-3`}
                >
                  <Text style={tw`font-display text-[15px] font-extrabold text-ink-700`}>Keep</Text>
                </Pressable>
                <Pressable
                  testID="kid-remove-confirm"
                  onPress={() => void handleDelete()}
                  disabled={deleting}
                  style={tw.style('flex-1 items-center justify-center rounded-pill bg-danger py-3', deleting ? 'opacity-60' : '')}
                >
                  <Text style={tw`font-display text-[15px] font-extrabold text-white`}>
                    {deleting ? 'Removing…' : 'Remove'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={tw`pt-1`}>
              <ActionRow testID="kid-bonus" icon="star" label="Give bonus" iconColor="#8A6400" onPress={onGiveBonus} />
              <ActionRow testID="kid-history" icon="clock" label="History" iconColor="#5B63E6" onPress={onHistory} />
              <ActionRow testID="kid-pin" icon="lock" label="Change PIN" iconColor="#5B63E6" onPress={onChangePin} />
              <ActionRow testID="kid-edit" icon="pencil" label="Edit" iconColor="#5B63E6" onPress={onEdit} />
              <ActionRow
                testID="kid-remove"
                icon="trash-2"
                label="Remove"
                color="#B11216"
                onPress={() => setConfirming(true)}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
