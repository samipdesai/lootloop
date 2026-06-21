// Pill segmented control. Mirrors design/components/core/Tabs.jsx. Used for the
// onboarding Create / Join toggle (spec §5.3).
import { Pressable, Text, View } from 'react-native';

export interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <View className="w-full flex-row gap-1 rounded-pill bg-ink-100 p-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.value)}
            className={`h-10 flex-1 items-center justify-center rounded-pill ${active ? 'bg-surface-card' : 'bg-transparent'}`}
            style={
              active
                ? { shadowColor: 'rgba(32,36,58,1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }
                : undefined
            }
          >
            <Text
              className={`font-display text-[14px] font-bold ${active ? 'text-ink-900' : 'text-ink-500'}`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
