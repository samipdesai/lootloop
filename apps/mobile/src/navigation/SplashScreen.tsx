// Loading splash while the session + parent-profile lookup resolves (#10).
import { ActivityIndicator, Text, View } from 'react-native';
import tw from '../lib/tw';

export function SplashScreen() {
  return (
    <View style={tw`flex-1 items-center justify-center gap-4 bg-surface-page`}>
      <Text style={tw`text-[56px]`}>🪙</Text>
      <Text style={tw`font-display text-[28px] font-extrabold text-ink-900`}>LootLoop</Text>
      <ActivityIndicator color="#F4720E" />
    </View>
  );
}
