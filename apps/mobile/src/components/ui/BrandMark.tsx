// Brand SVG marks from the design system (design project assets/*.svg), rendered
// via react-native-svg's SvgXml so they stay crisp at any size. These replace the
// emoji stand-ins (🪙 / logo) used before the icon system landed.
//   - Coin:     the gold loot coin (currency, rewards, points)
//   - Logomark: the "loop + coin" app logomark (auth / splash chrome)
//   - Looty:    the coin mascot face (celebrations, empty states, kid delight)
import { SvgXml } from 'react-native-svg';

const COIN_XML = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="20" fill="#FFC93C"/>
  <circle cx="24" cy="24" r="20" stroke="#F0B315" stroke-width="2.5"/>
  <circle cx="24" cy="24" r="14" stroke="#F0B315" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round" opacity="0.7"/>
  <path d="M24 15l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z" fill="#fff"/>
</svg>`;

const LOGOMARK_XML = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M52 24a22 22 0 1 0 4 14" stroke="#F4720E" stroke-width="6" stroke-linecap="round"/>
  <path d="M50 12l4 13-13 3" stroke="#F4720E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="33" r="15" fill="#FFC93C"/>
  <circle cx="32" cy="33" r="15" stroke="#F0B315" stroke-width="2.5"/>
  <circle cx="32" cy="33" r="10.5" stroke="#F0B315" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round" opacity="0.7"/>
  <path d="M32 26.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="#fff"/>
</svg>`;

const LOOTY_XML = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="58" rx="16" ry="3" fill="#20243A" opacity="0.08"/>
  <circle cx="32" cy="30" r="24" fill="#FFC93C"/>
  <circle cx="32" cy="30" r="24" stroke="#F0B315" stroke-width="3"/>
  <circle cx="32" cy="30" r="18" stroke="#F0B315" stroke-width="2.5" opacity="0.55"/>
  <circle cx="22" cy="33" r="3.4" fill="#FF8FB0" opacity="0.8"/>
  <circle cx="42" cy="33" r="3.4" fill="#FF8FB0" opacity="0.8"/>
  <circle cx="25.5" cy="27" r="3" fill="#20243A"/>
  <circle cx="38.5" cy="27" r="3" fill="#20243A"/>
  <circle cx="26.6" cy="26" r="1" fill="#fff"/>
  <circle cx="39.6" cy="26" r="1" fill="#fff"/>
  <path d="M26 33.5c1.6 3 4.2 4 6 4s4.4-1 6-4" stroke="#20243A" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M49 14l1.1 3 3 1.1-3 1.1L49 23l-1.1-3-3-1.1 3-1.1z" fill="#fff"/>
</svg>`;

export function Coin({ size = 24 }: { size?: number }) {
  return <SvgXml xml={COIN_XML} width={size} height={size} />;
}

export function Logomark({ size = 64 }: { size?: number }) {
  return <SvgXml xml={LOGOMARK_XML} width={size} height={size} />;
}

export function Looty({ size = 64 }: { size?: number }) {
  return <SvgXml xml={LOOTY_XML} width={size} height={size} />;
}
