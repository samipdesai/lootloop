// Generic placeholder for shell tabs/panes filled by later tasks (#11+).
import { Text, View } from 'react-native';
import tw from '../lib/tw';

export function PlaceholderScreen({ label }: { label: string }) {
  return (
    <View style={tw`flex-1 items-center justify-center bg-surface-page px-5`}>
      <Text style={tw`font-display text-[24px] font-extrabold text-ink-900`}>{label}</Text>
      <Text style={tw`mt-2 font-sans text-[14px] font-semibold text-ink-500`}>
        Coming soon — built in a later task.
      </Text>
    </View>
  );
}
