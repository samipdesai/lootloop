// Pill button with the LootLoop chunky 3D bottom edge (depresses on press).
// Mirrors design/components/core/Button.jsx — variants used in auth: primary
// (orange) + ghost. `loading` swaps the label for a spinner and locks the press.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import tw from '../../lib/tw';

type Variant = 'primary' | 'mint' | 'indigo' | 'coin' | 'ghost';
type Size = 'lg' | 'sm';

// Per-variant fill + chunky-edge color + label color (mirrors the design Button).
const PALETTE: Record<
  Exclude<Variant, 'ghost'>,
  { bg: string; edge: string; spinner: string; label: string }
> = {
  primary: { bg: 'bg-orange', edge: '#D85F06', spinner: '#FFFFFF', label: 'text-white' },
  mint: { bg: 'bg-mint', edge: '#0E9E68', spinner: '#FFFFFF', label: 'text-white' },
  indigo: { bg: 'bg-indigo', edge: '#444CCB', spinner: '#FFFFFF', label: 'text-white' },
  coin: { bg: 'bg-coin', edge: '#F0B315', spinner: '#8A6400', label: 'text-coin-ink' },
};

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
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
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const s = SIZE[size];
  const isGhost = variant === 'ghost';
  const p = isGhost ? null : PALETTE[variant];

  // The 3D edge is a hard offset shadow; on press the button drops to a 2px
  // edge + translates down 2px. Ghost has no edge.
  const edge = isGhost || isDisabled ? 0 : pressed ? 2 : s.edge;

  const labelColor = isDisabled
    ? 'text-ink-400'
    : isGhost
      ? 'text-orange-strong'
      : (p as NonNullable<typeof p>).label;

  return (
    <Pressable
      testID={testID}
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
        isDisabled ? 'bg-ink-200' : isGhost ? 'bg-transparent' : (p as NonNullable<typeof p>).bg,
        pressed && !isGhost && !isDisabled ? { transform: [{ translateY: 2 }] } : null,
        edge > 0 && p
          ? {
              shadowColor: p.edge,
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
          <ActivityIndicator color={isGhost ? '#D85F06' : (p as NonNullable<typeof p>).spinner} />
          <Text style={tw.style('font-display font-bold', s.text, labelColor)}>{children}</Text>
        </View>
      ) : (
        <Text style={tw.style('font-display font-bold', s.text, labelColor)}>{children}</Text>
      )}
    </Pressable>
  );
}
