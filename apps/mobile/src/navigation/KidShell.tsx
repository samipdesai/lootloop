// Kid shell (#9-client / #15 / #16). Rendered by RootNavigator once a kid is
// signed in (family code + PIN). Hosts the kid surfaces; for now that's My
// Chores (#15/#16). Age-mode (#38+) and the other kid tabs (dashboard, rewards,
// savings, reading) land in later tasks — this is the adaptive shell they slot
// into. One component tree; the header branches on size class only.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKidSession } from '../stores/kidSession';
import { useSizeClass } from '../hooks/useSizeClass';
import { MyChoresScreen } from '../screens/kid-chores/MyChoresScreen';
import tw from '../lib/tw';

export function KidShell() {
  const { profile, signOut } = useKidSession();
  const insets = useSafeAreaInsets();
  const isRegular = useSizeClass() === 'regular';

  return (
    <View style={tw`flex-1 bg-surface-page`} >
      <View
        style={[
          tw.style(
            'flex-row items-center justify-between gap-3 border-b border-ink-200 bg-surface-card px-5',
            isRegular ? 'py-5' : 'py-3.5',
          ),
          { paddingTop: insets.top + (isRegular ? 16 : 10) },
        ]}
      >
        <View style={tw`min-w-0 flex-1`}>
          <Text style={tw`font-sans text-[12px] font-bold uppercase tracking-wide text-ink-400`}>
            Chores
          </Text>
          <Text
            numberOfLines={1}
            style={tw.style(
              'font-display font-extrabold text-ink-900',
              isRegular ? 'text-[24px]' : 'text-[20px]',
            )}
          >
            Hi, {profile?.display_name ?? 'friend'}!
          </Text>
        </View>
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

      <View style={tw`flex-1`}>
        <MyChoresScreen />
      </View>
    </View>
  );
}
