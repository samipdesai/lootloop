// Age-mode design system (#38 Simple 5-8 / #39 Detailed 9-12 / #40 Teen 13-15).
// useAgeMode() (hooks/useAgeMode.ts) resolves the signed-in kid's band; this maps
// each band to concrete presentation tokens so kid screens can look meaningfully
// different per age without bespoke forks. Values are plain numbers / valid
// twrnc token names so screens drop them straight into `tw` template strings,
// e.g. `tw\`text-[${t.titleSize}px]\``, `tw.style('rounded-' + t.cardRadius)`,
// `{ minHeight: t.touchTarget }`.
//
// Design intent across the bands (monotonic where it matters):
//   Simple   — biggest type, largest touch targets, oversized icons, chunkiest
//              radii, most playful, maximum gamification/celebration.
//   Detailed — balanced default: moderate type/spacing, some stats, medium
//              gamification.
//   Teen     — most compact/refined, smallest flourishes, least gamification
//              (mature, understated), densest information.
import { useAgeMode, type AgeMode } from '../hooks/useAgeMode';

// A valid borderRadius token from apps/mobile/tailwind.config.js.
export type RadiusToken = 'md' | 'lg' | 'xl' | '2xl' | 'card';

export interface AgeModeTheme {
  mode: AgeMode;
  // Type scale (px) — hero/screen title, section heading, body/label, caption.
  titleSize: number;
  headingSize: number;
  bodySize: number;
  captionSize: number;
  // Minimum height (px) for primary buttons + tappable list rows.
  touchTarget: number;
  // Multiplier applied to a screen's base icon/emoji size (1 = default).
  iconScale: number;
  // Card corner radius token (use as `rounded-${cardRadius}`).
  cardRadius: RadiusToken;
  // Base vertical gap (px) between cards/sections — looser for younger kids.
  gap: number;
  // How much playful gamification a screen should show.
  gamification: 'high' | 'medium' | 'low';
  // Whether to show celebratory flourishes (confetti, big "Yay!", emoji bursts).
  celebrate: boolean;
}

const THEMES: Record<AgeMode, AgeModeTheme> = {
  simple: {
    mode: 'simple',
    titleSize: 34,
    headingSize: 22,
    bodySize: 18,
    captionSize: 14,
    touchTarget: 64,
    iconScale: 1.4,
    cardRadius: '2xl',
    gap: 16,
    gamification: 'high',
    celebrate: true,
  },
  detailed: {
    mode: 'detailed',
    titleSize: 28,
    headingSize: 18,
    bodySize: 15,
    captionSize: 12,
    touchTarget: 52,
    iconScale: 1.0,
    cardRadius: 'card',
    gap: 12,
    gamification: 'medium',
    celebrate: true,
  },
  teen: {
    mode: 'teen',
    titleSize: 24,
    headingSize: 16,
    bodySize: 14,
    captionSize: 11,
    touchTarget: 46,
    iconScale: 0.9,
    cardRadius: 'md',
    gap: 10,
    gamification: 'low',
    celebrate: false,
  },
};

/** Presentation tokens for an age band. Unknown/null → the balanced 'detailed'. */
export function ageModeTheme(mode: AgeMode): AgeModeTheme {
  return THEMES[mode] ?? THEMES.detailed;
}

/** Convenience: the theme for the currently signed-in kid's age band. */
export function useAgeModeTheme(): AgeModeTheme {
  return ageModeTheme(useAgeMode());
}
