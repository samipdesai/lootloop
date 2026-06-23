// Tonal rounded icon tile for a schedule row — renders the item's Lucide icon
// (stored as a lucide id), falling back to a clock. 44px rounded mint tile.
import { View } from 'react-native';
import { Icon, type IconName } from '../../components/ui/Icon';
import tw from '../../lib/tw';

const SCHEDULE_ICONS = new Set<string>([
  'clock',
  'utensils',
  'book-open',
  'book',
  'bed',
  'calendar-clock',
  'star',
  'bell',
  'sparkles',
]);

export function ScheduleIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
  const name: IconName = icon && SCHEDULE_ICONS.has(icon) ? (icon as IconName) : 'clock';
  return (
    <View
      accessible={false}
      style={tw.style(
        'h-11 w-11 shrink-0 items-center justify-center rounded-md',
        muted ? 'bg-ink-100' : 'bg-mint-soft',
      )}
    >
      <Icon name={name} size={22} color={muted ? '#A39CAD' : '#0A6A46'} />
    </View>
  );
}
