import { Text, View } from 'react-native';
import { GhostLink } from '../../components/ui/GhostLink';
import tw from '../../lib/tw';

interface AuthFooterProps {
  prompt: string;
  label: string;
  onPress: () => void;
}

export function AuthFooter({ prompt, label, onPress }: AuthFooterProps) {
  return (
    <View style={tw`flex-row items-center`}>
      <Text style={tw`font-sans text-[14px] font-semibold text-ink-500`}>{prompt}</Text>
      <GhostLink label={label} onPress={onPress} />
    </View>
  );
}
