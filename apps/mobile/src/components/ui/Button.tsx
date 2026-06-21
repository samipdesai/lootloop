// Pill button with the LootLoop chunky 3D bottom edge (depresses on press).
// Mirrors design/components/core/Button.jsx — variants used in auth: primary
// (orange) + ghost. `loading` swaps the label for a spinner and locks the press.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import tw from '../../lib/tw';

type Variant = 'primary' | 'ghost';
type Size = 'lg' | 'sm';

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

const SIZE = {
  lg: { h: 'h-14', text: 'text-[18px]', edge: 4 },
  sm: { h: 'h-9', text: 'text-[14px]', edge: 3 },
} as const;

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  block = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const s = SIZE[size];
  const isGhost = variant === 'ghost';

  // The 3D edge is a hard offset shadow; on press the button drops to a 2px
  // edge + translates down 2px. Ghost has no edge.
  const edge = isGhost || isDisabled ? 0 : pressed ? 2 : s.edge;

  const labelColor = isDisabled ? 'text-ink-400' : isGhost ? 'text-orange-strong' : 'text-white';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={tw.style(
        'flex-row items-center justify-center gap-2 rounded-pill px-7',
        s.h,
        block ? 'w-full' : 'self-start',
        isDisabled ? 'bg-ink-200' : isGhost ? 'bg-transparent' : 'bg-orange',
        pressed && !isGhost && !isDisabled ? { transform: [{ translateY: 2 }] } : null,
        edge > 0
          ? {
              shadowColor: '#D85F06',
              shadowOffset: { width: 0, height: edge },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: edge,
            }
          : null,
      )}
    >
      {loading ? (
        <View style={tw`flex-row items-center gap-2`}>
          <ActivityIndicator color={isGhost ? '#D85F06' : '#FFFFFF'} />
          <Text style={tw.style('font-display font-bold', s.text, labelColor)}>{children}</Text>
        </View>
      ) : (
        <Text style={tw.style('font-display font-bold', s.text, labelColor)}>{children}</Text>
      )}
    </Pressable>
  );
}
