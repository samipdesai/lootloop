// Avatar (design system core) — round, colorful kid avatar with an initial
// fallback. Colour is picked deterministically from the name so a kid keeps the
// same hue. `ring` draws the gold "active" ring (coin) used on the signed-in kid.
import { Image, Text, View } from 'react-native';
import tw from '../../lib/tw';

// Warm-palette hues (the design's blue isn't defined in this token set).
const TONES = ['#5B63E6', '#16B97D', '#F4720E', '#F0B315', '#444CCB'];

export function Avatar({
  name,
  src,
  size = 48,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const bg = TONES[(initial.charCodeAt(0) || 0) % TONES.length];
  const circle = (
    <View
      style={tw.style('items-center justify-center overflow-hidden rounded-full', {
        width: size,
        height: size,
        backgroundColor: src ? '#F0EDF2' : bg,
      })}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={tw.style('font-display font-bold text-white', { fontSize: size * 0.42 })}>
          {initial}
        </Text>
      )}
    </View>
  );
  if (!ring) return circle;
  // Gold ring = white gap + coin halo (matches the design's double box-shadow).
  return (
    <View style={tw`rounded-full bg-coin p-0.5`}>
      <View style={tw`rounded-full bg-surface-card p-0.5`}>{circle}</View>
    </View>
  );
}
