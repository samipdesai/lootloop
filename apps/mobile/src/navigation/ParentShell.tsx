// Parent shell (#10). Adaptive: ParentTabs on compact (iPhone), ParentSplitView
// on regular (iPad). Screens are placeholders filled by later tasks. One
// component tree, branched on useSizeClass().
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ParentTabParamList } from './types';
import { useSizeClass } from '../hooks/useSizeClass';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { ChoresScreen } from '../screens/chores';
import { ApprovalsScreen } from '../screens/approvals';
import tw from '../lib/tw';

const SECTIONS: { key: keyof ParentTabParamList; label: string }[] = [
  { key: 'Home', label: 'Home' },
  { key: 'Chores', label: 'Chores' },
  { key: 'Approvals', label: 'Approvals' },
  { key: 'Kids', label: 'Kids' },
  { key: 'Rewards', label: 'Rewards' },
  { key: 'Schedule', label: 'Schedule' },
];

// Built sections render their real screen; the rest stay placeholders until
// their tasks land. One resolver keeps the iPhone tabs (ParentTabs) and the
// iPad split-view detail in sync.
function renderSection(key: keyof ParentTabParamList, label: string) {
  switch (key) {
    case 'Chores':
      return <ChoresScreen />;
    case 'Approvals':
      return <ApprovalsScreen />;
    default:
      return <PlaceholderScreen label={label} />;
  }
}

const Tab = createBottomTabNavigator<ParentTabParamList>();

function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      {SECTIONS.map((s) => (
        <Tab.Screen key={s.key} name={s.key} children={() => renderSection(s.key, s.label)} />
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
    <View style={tw`flex-1 flex-row bg-surface-page`}>
      <View style={tw`w-64 gap-1 border-r border-ink-200 bg-surface-card px-3 py-6`}>
        <Text style={tw`mb-3 px-3 font-display text-[22px] font-extrabold text-ink-900`}>
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
              style={tw.style('rounded-md px-3 py-3', selected ? 'bg-orange-soft' : 'bg-transparent')}
            >
              <Text
                style={tw.style('font-sans text-[16px] font-bold', selected ? 'text-orange-ink' : 'text-ink-700')}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={tw`flex-1`}>{renderSection(active, activeLabel)}</View>
    </View>
  );
}

export function ParentShell() {
  const sizeClass = useSizeClass();
  return sizeClass === 'regular' ? <ParentSplitView /> : <ParentTabs />;
}
