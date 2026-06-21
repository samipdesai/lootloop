// Kid shell placeholder (#10). Wired into the role branch for later tasks. The
// kid PIN login (#9) is DEFERRED pending a product decision — do NOT build it
// here. KidTabs (compact) / KidSplitView (regular) are stubbed to mirror the
// parent shell's adaptive shape; real kid screens + useAgeMode branching land in
// #15/#38+.
import { Text, View } from 'react-native';
import { useSizeClass } from '../hooks/useSizeClass';

function KidStub({ variant }: { variant: 'KidTabs' | 'KidSplitView' }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-5">
      <Text className="font-display text-[24px] font-extrabold text-ink-900">{variant}</Text>
      <Text className="mt-2 text-center font-sans text-[14px] font-semibold text-ink-500">
        Kid surface placeholder. {/* TODO(#9): kid PIN login — deferred. */}
      </Text>
    </View>
  );
}

export function KidShell() {
  const sizeClass = useSizeClass();
  return sizeClass === 'regular' ? (
    <KidStub variant="KidSplitView" />
  ) : (
    <KidStub variant="KidTabs" />
  );
}
