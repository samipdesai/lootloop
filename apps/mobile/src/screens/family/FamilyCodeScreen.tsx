// Parent: Family code (Settings → Family code). The device-pairing code a kid
// enters to sign in. Pushed from the Home settings menu; the FamilyCodePanel
// (show / copy / regenerate) is reused from the kids surface.
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { FamilyCodePanel } from '../kids/FamilyCodePanel';
import { useParentNav } from '../../navigation/ParentNav';
import tw from '../../lib/tw';

export function FamilyCodeScreen() {
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
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Family code</Text>
        </View>
      </View>
      <Text style={tw`font-sans text-[15px] font-semibold text-ink-500`}>
        Kids enter this code on their device to sign in. Keep it private; regenerate it if it leaks.
      </Text>
      <FamilyCodePanel />
    </ScrollView>
  );
}
