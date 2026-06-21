// Inline ghost text link (indigo, Nunito 700). Used for footer + helper links
// in the auth screens.
import { Pressable, Text } from 'react-native';

interface GhostLinkProps {
  label: string;
  onPress: () => void;
  size?: 'caption' | 'body';
}

export function GhostLink({ label, onPress, size = 'body' }: GhostLinkProps) {
  return (
    <Pressable accessibilityRole="link" hitSlop={6} onPress={onPress}>
      <Text
        className={`font-sans font-bold text-indigo-strong ${size === 'caption' ? 'text-[13px]' : 'text-[14px]'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
