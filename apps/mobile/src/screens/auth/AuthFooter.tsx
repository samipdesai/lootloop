import { Text, View } from 'react-native';
import { GhostLink } from '../../components/ui/GhostLink';

interface AuthFooterProps {
  prompt: string;
  label: string;
  onPress: () => void;
}

export function AuthFooter({ prompt, label, onPress }: AuthFooterProps) {
  return (
    <View className="flex-row items-center">
      <Text className="font-sans text-[14px] font-semibold text-ink-500">{prompt}</Text>
      <GhostLink label={label} onPress={onPress} />
    </View>
  );
}
