// Tonal rounded icon tile for a schedule row. Mirrors the chores ChoreIcon: a
// 44px rounded tile showing the first two letters of the stored lucide icon name
// (a clock glyph when no icon is set). lucide isn't a mobile dependency yet.
import { Text, View } from 'react-native';
import tw from '../../lib/tw';

export function ScheduleIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
  const label = icon ? icon.slice(0, 2).toUpperCase() : null;
  return (
    <View
      accessible={false}
      style={tw.style(
        'h-11 w-11 shrink-0 items-center justify-center rounded-md',
        muted ? 'bg-ink-100' : 'bg-mint-soft',
      )}
    >
      <Text
        style={tw.style(
          'font-display text-[15px] font-extrabold',
          muted ? 'text-ink-400' : 'text-mint-ink',
        )}
      >
        {label ?? '🕑'}
      </Text>
    </View>
  );
}
