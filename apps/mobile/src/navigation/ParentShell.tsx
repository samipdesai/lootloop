// Parent shell (#10). Adaptive: ParentTabs on compact (iPhone), ParentSplitView
// on regular (iPad). Screens are placeholders filled by later tasks. One
// component tree, branched on useSizeClass().
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ParentTabParamList } from './types';
import { useSizeClass } from '../hooks/useSizeClass';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { ChoresScreen } from '../screens/chores';
import { ApprovalsScreen } from '../screens/approvals';
import { KidsScreen } from '../screens/kids';
import { RewardsScreen } from '../screens/rewards';
import { ScheduleScreen } from '../screens/schedule';
import { FamilyOverviewScreen } from '../screens/family';
import { Icon, type IconName } from '../components/ui/Icon';
import tw from '../lib/tw';

type Section = { key: keyof ParentTabParamList; label: string; icon: IconName };

// Full section set (iPad sidebar shows all of these).
const SECTIONS: Section[] = [
  { key: 'Home', label: 'Home', icon: 'layout-dashboard' },
  { key: 'Chores', label: 'Chores', icon: 'list-todo' },
  { key: 'Approvals', label: 'Approvals', icon: 'inbox' },
  { key: 'Kids', label: 'Kids', icon: 'users' },
  { key: 'Rewards', label: 'Rewards', icon: 'gift' },
  { key: 'Schedule', label: 'Schedule', icon: 'calendar-clock' },
];

// iPhone bottom bar = the 4 design tabs (canvas parent nav). Kids + Schedule are
// reached from the Home hub via the parent stack below, not as tabs.
const TAB_KEYS: (keyof ParentTabParamList)[] = ['Home', 'Chores', 'Rewards', 'Approvals'];
const TAB_SECTIONS: Section[] = TAB_KEYS.map((k) => SECTIONS.find((s) => s.key === k)!);

// Built sections render their real screen; the rest stay placeholders until
// their tasks land. One resolver keeps the iPhone tabs (ParentTabs) and the
// iPad split-view detail in sync.
function renderSection(key: keyof ParentTabParamList, label: string) {
  switch (key) {
    case 'Chores':
      return <ChoresScreen />;
    case 'Approvals':
      return <ApprovalsScreen />;
    case 'Kids':
      return <KidsScreen />;
    case 'Rewards':
      return <RewardsScreen />;
    case 'Schedule':
      return <ScheduleScreen />;
    case 'Home':
      return <FamilyOverviewScreen />;
    default:
      return <PlaceholderScreen label={label} />;
  }
}

const Tab = createBottomTabNavigator<ParentTabParamList>();

function ParentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F4720E',
        tabBarInactiveTintColor: '#A39CAD',
      }}
    >
      {TAB_SECTIONS.map((s) => (
        <Tab.Screen
          key={s.key}
          name={s.key}
          options={{
            tabBarLabel: s.label,
            tabBarButtonTestID: `ptab-${s.key}`,
            tabBarIcon: ({ focused }) => (
              <Icon name={s.icon} size={24} color={focused ? '#F4720E' : '#A39CAD'} />
            ),
          }}
          children={() => renderSection(s.key, s.label)}
        />
      ))}
    </Tab.Navigator>
  );
}

// iPhone parent navigation: the 4 tabs at the root + Kids / Schedule pushed from
// the Home hub (canvas reaches these from Family, not the tab bar).
const ParentStack = createNativeStackNavigator();

function ParentStackNav() {
  return (
    <ParentStack.Navigator screenOptions={{ headerShown: false }}>
      <ParentStack.Screen name="ParentTabs" component={ParentTabs} />
      <ParentStack.Screen name="Kids" component={KidsScreen} />
      <ParentStack.Screen name="Schedule" component={ScheduleScreen} />
    </ParentStack.Navigator>
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
              style={tw.style(
                'flex-row items-center gap-2.5 rounded-md px-3 py-3',
                selected ? 'bg-orange-soft' : 'bg-transparent',
              )}
            >
              <Icon name={s.icon} size={20} color={selected ? '#8A4309' : '#443F4E'} />
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
  return sizeClass === 'regular' ? <ParentSplitView /> : <ParentStackNav />;
}
