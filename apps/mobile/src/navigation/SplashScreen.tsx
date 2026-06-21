// Loading splash while the session + parent-profile lookup resolves (#10).
import { ActivityIndicator, Text, View } from 'react-native';

export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface-page">
      <Text className="text-[56px]">🪙</Text>
      <Text className="font-display text-[28px] font-extrabold text-ink-900">LootLoop</Text>
      <ActivityIndicator color="#F4720E" />
    </View>
  );
}
