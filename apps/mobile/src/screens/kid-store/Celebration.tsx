// #26 Celebration — a pure React Native `Animated` burst that plays when a kid
// buys a reward. No new native dependency (no lottie / no pod install): just a
// full-screen, non-interactive overlay with a ring of coin/emoji particles that
// fly outward + fade, behind a "Yay!" badge that pops and settles.
//
// Self-contained: mount it with a `token` that changes on each successful
// purchase; it runs once per token and calls `onDone` when finished. The parent
// keeps it mounted and just bumps the token.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import tw from '../../lib/tw';

const PARTICLES = ['🪙', '🎉', '⭐', '🪙', '🎊', '✨', '🪙', '🎉', '⭐', '✨', '🪙', '🎊'];
const RADIUS = 150; // px the particles travel outward
const DURATION = 1100;

function Particle({ glyph, angle, progress }: { glyph: string; angle: number; progress: Animated.Value }) {
  // Each particle flies from center outward along its angle, fading + shrinking.
  const dx = Math.cos(angle) * RADIUS;
  const dy = Math.sin(angle) * RADIUS;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1.2, 0.6] });
  const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.Text
      style={[tw`absolute text-[30px]`, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
    >
      {glyph}
    </Animated.Text>
  );
}

export function Celebration({ token, onDone }: { token: number; onDone?: () => void }) {
  // Drives the particles (0→1). Reset + replayed whenever `token` changes.
  const burst = useRef(new Animated.Value(0)).current;
  // Drives the "Yay!" badge pop (scale + opacity).
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (token === 0) return; // 0 = idle / never fired yet
    burst.setValue(0);
    pop.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(burst, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.delay(450),
        Animated.timing(pop, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => anim.stop();
    // onDone is intentionally excluded — replay is keyed purely on `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (token === 0) return null;

  const badgeScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View pointerEvents="none" style={tw`absolute inset-0 items-center justify-center`}>
      {PARTICLES.map((glyph, i) => (
        <Particle key={i} glyph={glyph} angle={(i / PARTICLES.length) * Math.PI * 2} progress={burst} />
      ))}
      <Animated.View
        style={[
          tw`rounded-pill bg-mint px-6 py-3`,
          { opacity: pop, transform: [{ scale: badgeScale }] },
        ]}
      >
        <Text style={tw`font-display text-[22px] font-extrabold text-white`}>Yay! 🎉</Text>
      </Animated.View>
    </View>
  );
}
