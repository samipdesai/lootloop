// Tonal rounded icon tile for a chore row. lucide isn't a mobile dependency yet,
// so we render a tile with the first two letters of the stored lucide icon name
// as a stand-in glyph (a checkmark when no icon is set). Visual intent mirrors
// design/ui_kits/app/Chores.jsx (44px rounded tile, indigo-soft fill).
import { Text, View } from 'react-native';
import tw from '../../lib/tw';

export function ChoreIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
  const label = icon ? icon.slice(0, 2).toUpperCase() : null;
  return (
    <View
      accessible={false}
      style={tw.style(
        'h-11 w-11 shrink-0 items-center justify-center rounded-md',
        muted ? 'bg-ink-100' : 'bg-indigo-soft',
      )}
    >
      <Text
        style={tw.style(
          'font-display text-[15px] font-extrabold',
          muted ? 'text-ink-400' : 'text-indigo-strong',
        )}
      >
        {label ?? '✓'}
      </Text>
    </View>
  );
}
