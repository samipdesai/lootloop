// Kid shell (#9-client / #15 / #19 / #23). Rendered by RootNavigator once a kid
// is signed in. Adaptive like ParentShell: bottom tabs on compact (iPhone),
// split-view on regular (iPad). A slim top bar keeps the greeting + log-out
// (shared family device). More tabs (savings, reading) land in later tasks.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { KidTabParamList } from './types';
import { useKidSession } from '../stores/kidSession';
import { useSizeClass } from '../hooks/useSizeClass';
import { KidDashboardScreen } from '../screens/kid-dashboard';
import { MyChoresScreen } from '../screens/kid-chores/MyChoresScreen';
import { KidStoreScreen } from '../screens/kid-store';
import { KidReadingScreen } from '../screens/kid-reading';
import { KidSavingsScreen } from '../screens/kid-savings';
import tw from '../lib/tw';

const SECTIONS: { key: keyof KidTabParamList; label: string; icon: string }[] = [
  { key: 'Home', label: 'Home', icon: '🏠' },
  { key: 'Chores', label: 'Chores', icon: '🧹' },
  { key: 'Store', label: 'Store', icon: '🎁' },
  { key: 'Reading', label: 'Reading', icon: '📚' },
  { key: 'Savings', label: 'Savings', icon: '🐷' },
];

function renderSection(key: keyof KidTabParamList) {
  switch (key) {
    case 'Chores':
      return <MyChoresScreen />;
    case 'Store':
      return <KidStoreScreen />;
    case 'Reading':
      return <KidReadingScreen />;
    case 'Savings':
      return <KidSavingsScreen />;
    default:
      return <KidDashboardScreen />;
  }
}

const Tab = createBottomTabNavigator<KidTabParamList>();

function KidTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      {SECTIONS.map((s) => (
        <Tab.Screen
          key={s.key}
          name={s.key}
          options={{
            tabBarLabel: s.label,
            tabBarButtonTestID: `tab-${s.key}`,
            tabBarIcon: ({ focused }) => (
              <Text style={tw.style('text-[18px]', focused ? '' : 'opacity-60')}>{s.icon}</Text>
            ),
          }}
          children={() => renderSection(s.key)}
        />
      ))}
    </Tab.Navigator>
  );
}

// iPad split-view: persistent sidebar of sections + detail pane (local state).
function KidSplitView() {
  const [active, setActive] = useState<keyof KidTabParamList>('Home');
  return (
    <View style={tw`flex-1 flex-row bg-surface-page`}>
      <View style={tw`w-60 gap-1 border-r border-ink-200 bg-surface-card px-3 py-5`}>
        {SECTIONS.map((s) => {
          const selected = s.key === active;
          return (
            <Pressable
              key={s.key}
              testID={`tab-${s.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActive(s.key)}
              style={tw.style(
                'flex-row items-center gap-2 rounded-md px-3 py-3',
                selected ? 'bg-orange-soft' : 'bg-transparent',
              )}
            >
              <Text style={tw`text-[18px]`}>{s.icon}</Text>
              <Text
                style={tw.style(
                  'font-sans text-[16px] font-bold',
                  selected ? 'text-orange-ink' : 'text-ink-700',
                )}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={tw`flex-1`}>{renderSection(active)}</View>
    </View>
  );
}

export function KidShell() {
  const { profile, signOut } = useKidSession();
  const insets = useSafeAreaInsets();
  const isRegular = useSizeClass() === 'regular';

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <View
        style={[
          tw.style(
            'flex-row items-center justify-between gap-3 border-b border-ink-200 bg-surface-card px-5',
            isRegular ? 'py-4' : 'py-3',
          ),
          { paddingTop: insets.top + (isRegular ? 14 : 8) },
        ]}
      >
        <Text
          numberOfLines={1}
          style={tw.style(
            'min-w-0 flex-1 font-display font-extrabold text-ink-900',
            isRegular ? 'text-[22px]' : 'text-[18px]',
          )}
        >
          Hi, {profile?.display_name ?? 'friend'}!
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={() => void signOut()}
          hitSlop={8}
          style={tw`rounded-pill bg-ink-100 px-4 py-2`}
        >
          <Text style={tw`font-sans text-[14px] font-bold text-ink-700`}>Log out</Text>
        </Pressable>
      </View>

      <View style={tw`flex-1`}>{isRegular ? <KidSplitView /> : <KidTabs />}</View>
    </View>
  );
}
