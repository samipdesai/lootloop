// Parent: Co-parents (Settings → Co-parents). Invite additional parents to the
// family and manage the roster + pending invites. Pushed from the Home settings
// menu; the CoParentsPanel holds the roster / invite / revoke UI.
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { CoParentsPanel } from './CoParentsPanel';
import { useParentNav } from '../../navigation/ParentNav';
import tw from '../../lib/tw';

export function CoParentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useParentNav();
  return (
    <ScrollView
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style('gap-4 px-5 pb-6', { paddingTop: insets.top + 12 })}
    >
      <View style={tw`flex-row items-center gap-2`}>
        {navigation.canGoBack() ? (
          <Pressable
            testID="parent-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={tw`h-10 w-10 items-center justify-center rounded-full bg-surface-card`}
          >
            <Icon name="chevron-left" size={22} color="#211E27" />
          </Pressable>
        ) : null}
        <View>
          <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
            Settings
          </Text>
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Co-parents</Text>
        </View>
      </View>
      <CoParentsPanel />
    </ScrollView>
  );
}
