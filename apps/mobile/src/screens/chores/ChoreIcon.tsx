// Tonal rounded icon tile for a chore row — renders the chore's Lucide icon
// (stored as a lucide id, e.g. "dog"/"bed"/"trash-2"), falling back to a check
// when unset/unknown. 44px rounded tile, indigo-soft fill (design Chores.jsx).
import { View } from 'react-native';
import { Icon, type IconName } from '../../components/ui/Icon';
import tw from '../../lib/tw';

// Lucide ids we expect chores to use (kept in sync with the Icon kit map).
const CHORE_ICONS = new Set<string>([
  'bed',
  'dog',
  'utensils',
  'book-open',
  'book',
  'trash-2',
  'sparkles',
  'list-todo',
  'star',
  'clock',
]);

export function ChoreIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
  const name: IconName = icon && CHORE_ICONS.has(icon) ? (icon as IconName) : 'circle-check-big';
  return (
    <View
      accessible={false}
      style={tw.style(
        'h-11 w-11 shrink-0 items-center justify-center rounded-md',
        muted ? 'bg-ink-100' : 'bg-indigo-soft',
      )}
    >
      <Icon name={name} size={22} color={muted ? '#A39CAD' : '#444CCB'} />
    </View>
  );
}
