// Segmented control (design system Tabs) — a pill track with the active segment
// raised on a white chip. Used for in-screen view switches (e.g. chore buckets).
import { Pressable, Text, View } from 'react-native';
import tw from '../../lib/tw';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={tw`flex-row gap-1 rounded-pill bg-ink-100 p-1`}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={tw.style(
              'flex-1 items-center justify-center rounded-pill py-2',
              active
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: 'rgba(32,36,58,1)',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 1,
                  }
                : null,
            )}
          >
            <Text
              style={tw.style(
                'font-display text-[14px] font-extrabold',
                active ? 'text-ink-900' : 'text-ink-500',
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
