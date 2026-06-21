// Parent shell (#10). Adaptive: ParentTabs on compact (iPhone), ParentSplitView
// on regular (iPad). Screens are placeholders filled by later tasks. One
// component tree, branched on useSizeClass().
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ParentTabParamList } from './types';
import { useSizeClass } from '../hooks/useSizeClass';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const SECTIONS: { key: keyof ParentTabParamList; label: string }[] = [
  { key: 'Home', label: 'Home' },
  { key: 'Chores', label: 'Chores' },
  { key: 'Approvals', label: 'Approvals' },
  { key: 'Kids', label: 'Kids' },
  { key: 'Rewards', label: 'Rewards' },
  { key: 'Schedule', label: 'Schedule' },
];

const Tab = createBottomTabNavigator<ParentTabParamList>();

function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      {SECTIONS.map((s) => (
        <Tab.Screen
          key={s.key}
          name={s.key}
          children={() => <PlaceholderScreen label={s.label} />}
        />
      ))}
    </Tab.Navigator>
  );
}

// iPad split-view: persistent sidebar of sections + detail pane. Lightweight
// local-state implementation (no nested navigator needed for placeholders).
function ParentSplitView() {
  const [active, setActive] = useState<keyof ParentTabParamList>('Home');
  const activeLabel = SECTIONS.find((s) => s.key === active)?.label ?? 'Home';

  return (
    <View className="flex-1 flex-row bg-surface-page">
      <View className="w-64 gap-1 border-r border-ink-200 bg-surface-card px-3 py-6">
        <Text className="mb-3 px-3 font-display text-[22px] font-extrabold text-ink-900">
          LootLoop
        </Text>
        {SECTIONS.map((s) => {
          const selected = s.key === active;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActive(s.key)}
              className={`rounded-md px-3 py-3 ${selected ? 'bg-orange-soft' : 'bg-transparent'}`}
            >
              <Text
                className={`font-sans text-[16px] font-bold ${selected ? 'text-orange-ink' : 'text-ink-700'}`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-1">
        <PlaceholderScreen label={activeLabel} />
      </View>
    </View>
  );
}

export function ParentShell() {
  const sizeClass = useSizeClass();
  return sizeClass === 'regular' ? <ParentSplitView /> : <ParentTabs />;
}
