// Kid management card (#15 / #19). One card per kid: avatar/initial, name,
// age-mode badge, optional wallet balance, and a per-row action set
// (Bonus / History / Edit / PIN / Remove) with an inline delete confirm (no
// blocking Alert.alert). Rendered by the parent Home (family/index.tsx), which
// owns the roster load + the action modals.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { KidProfile } from '@lootloop/client';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { ageModeBadge } from './ageMode';

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

export function KidRow({
  kid,
  balance,
  onEdit,
  onChangePin,
  onGiveBonus,
  onHistory,
  onDelete,
}: {
  kid: KidProfile;
  balance?: number | null;
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
      {/* Header: avatar + name + age band + optional balance */}
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
        {balance != null ? <CoinBadge amount={balance} size="sm" tone="soft" /> : null}
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
