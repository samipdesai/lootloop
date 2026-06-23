// Shared header for the kid pushed sub-screens (canvas 09/10/14/16/17/18): a
// round back chevron, optionally with an eyebrow + title beside it. Back goes
// through the adaptive shell nav (native-stack on iPhone, split-view on iPad).
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/Icon';
import { useShellNav } from '../../navigation/shellNav';
import tw from '../../lib/tw';

export function DetailHeader({ title, eyebrow }: { title?: string; eyebrow?: string }) {
  const insets = useSafeAreaInsets();
  const nav = useShellNav();
  return (
    <View style={tw.style('flex-row items-center gap-3 px-5 pb-2', { paddingTop: insets.top + 8 })}>
      {nav.canGoBack() ? (
        <Pressable
          testID="kid-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => nav.goBack()}
          style={tw.style('h-10 w-10 items-center justify-center rounded-full bg-surface-card', {
            shadowColor: 'rgba(32,36,58,1)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
          })}
        >
          <Icon name="chevron-left" size={22} color="#211E27" />
        </Pressable>
      ) : null}
      {title ? (
        <View>
          {eyebrow ? (
            <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-ink-400`}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>{title}</Text>
        </View>
      ) : null}
    </View>
  );
}
