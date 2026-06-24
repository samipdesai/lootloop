// Loading splash while the session + parent-profile lookup resolves (#10).
import { ActivityIndicator, View } from 'react-native';
import { Logomark, Wordmark } from '../components/ui/BrandMark';
import tw from '../lib/tw';

export function SplashScreen() {
  return (
    <View style={tw`flex-1 items-center justify-center gap-4 bg-surface-page`}>
      {/* Brand logomark (loop + coin), matching the auth screen. The previous
          🪙 emoji rendered as a grey "moon" disc on first frame. */}
      <Logomark size={64} />
      <Wordmark className="text-[28px] text-ink-900" />
      <ActivityIndicator color="#F4720E" />
    </View>
  );
}
