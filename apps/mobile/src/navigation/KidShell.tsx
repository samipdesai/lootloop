// Kid shell (#9-client / #15 / #19 / #23). Rendered by RootNavigator once a kid
// is signed in. Adaptive like ParentShell: bottom tabs on compact (iPhone),
// split-view on regular (iPad). A slim top bar keeps the greeting + log-out
// (shared family device). More tabs (savings, reading) land in later tasks.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { KidTabParamList, KidStackParamList } from './types';
import { ShellNavContext, type ShellNav } from './shellNav';
import { useKidSession } from '../stores/kidSession';
import { useSizeClass } from '../hooks/useSizeClass';
import { KidDashboardScreen } from '../screens/kid-dashboard';
import { MyChoresScreen } from '../screens/kid-chores/MyChoresScreen';
import { KidStoreScreen } from '../screens/kid-store';
import { KidReadingScreen } from '../screens/kid-reading';
import { KidSavingsScreen } from '../screens/kid-savings';
import { KID_DETAIL_SCREENS, type KidDetailName } from '../screens/kid-detail';
import { Icon, type IconName } from '../components/ui/Icon';
import tw from '../lib/tw';

const SECTIONS: { key: keyof KidTabParamList; label: string; icon: IconName }[] = [
  { key: 'Home', label: 'Home', icon: 'house' },
  { key: 'Chores', label: 'Chores', icon: 'list-todo' },
  { key: 'Store', label: 'Store', icon: 'gift' },
  { key: 'Reading', label: 'Reading', icon: 'book-open' },
  { key: 'Savings', label: 'Savings', icon: 'piggy-bank' },
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
            tabBarActiveTintColor: '#F4720E',
            tabBarInactiveTintColor: '#A39CAD',
            tabBarIcon: ({ focused }) => (
              <Icon name={s.icon} size={24} color={focused ? '#F4720E' : '#A39CAD'} />
            ),
          }}
          children={() => renderSection(s.key)}
        />
      ))}
    </Tab.Navigator>
  );
}

// iPad split-view: persistent sidebar of sections + detail pane. Controlled — the
// active tab lives in KidShellRegular so shell navigations (e.g. the Home
// shortcuts) can switch it.
function KidSplitView({
  active,
  onSelect,
}: {
  active: keyof KidTabParamList;
  onSelect: (key: keyof KidTabParamList) => void;
}) {
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
              onPress={() => onSelect(s.key)}
              style={tw.style(
                'flex-row items-center gap-2 rounded-md px-3 py-3',
                selected ? 'bg-orange-soft' : 'bg-transparent',
              )}
            >
              <Icon name={s.icon} size={22} color={selected ? '#8A4309' : '#443F4E'} />
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

// The slim greeting + log-out top bar, shared by the iPhone home and iPad shell.
function KidTopBar() {
  const { profile, signOut } = useKidSession();
  const insets = useSafeAreaInsets();
  const isRegular = useSizeClass() === 'regular';
  return (
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
  );
}

// iPhone root: greeting bar + bottom tabs. Sub-screens push over this in the
// native-stack below.
function KidHome() {
  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <KidTopBar />
      <View style={tw`flex-1`}>
        <KidTabs />
      </View>
    </View>
  );
}

// iPhone: a native-stack with the tab home as root + the pushed detail screens.
const KidStack = createNativeStackNavigator<KidStackParamList>();

function KidStackNav() {
  return (
    <KidStack.Navigator screenOptions={{ headerShown: false }}>
      <KidStack.Screen name="KidHome" component={KidHome} />
      {(Object.keys(KID_DETAIL_SCREENS) as KidDetailName[]).map((name) => (
        <KidStack.Screen key={name} name={name} component={KID_DETAIL_SCREENS[name]} />
      ))}
    </KidStack.Navigator>
  );
}

// iPad: greeting bar + split view, with pushed sub-screens shown full-screen on
// top (their own back chevron). A small frame stack mirrors ParentSplitView and
// is exposed to the sub-screens via ShellNavContext.
const TAB_KEYS = new Set<string>(SECTIONS.map((s) => s.key));

function KidShellRegular() {
  const [activeTab, setActiveTab] = useState<keyof KidTabParamList>('Home');
  const [stack, setStack] = useState<{ name: KidDetailName; params?: Record<string, unknown> }[]>([]);
  const top = stack[stack.length - 1];

  const nav = useMemo<ShellNav>(
    () => ({
      // Tab names switch the split's active section; detail names push full-screen.
      navigate: (name, params) => {
        if (TAB_KEYS.has(name)) {
          setActiveTab(name as keyof KidTabParamList);
          setStack([]);
        } else {
          setStack((s) => [...s, { name: name as KidDetailName, params }]);
        }
      },
      goBack: () => setStack((s) => (s.length > 0 ? s.slice(0, -1) : s)),
      canGoBack: () => stack.length > 0,
      params: top?.params,
    }),
    [stack.length, top?.params],
  );

  const Detail = top ? KID_DETAIL_SCREENS[top.name] : null;

  return (
    <ShellNavContext.Provider value={nav}>
      {Detail ? (
        <Detail />
      ) : (
        <View style={tw`flex-1 bg-surface-page`}>
          <KidTopBar />
          <View style={tw`flex-1`}>
            <KidSplitView active={activeTab} onSelect={setActiveTab} />
          </View>
        </View>
      )}
    </ShellNavContext.Provider>
  );
}

export function KidShell() {
  const isRegular = useSizeClass() === 'regular';
  return isRegular ? <KidShellRegular /> : <KidStackNav />;
}
