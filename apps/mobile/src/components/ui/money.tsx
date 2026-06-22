// Money component kit — RN/twrnc port of the design system's money components
// (components/money/* in the Claude Design project), used across the kid screens.
// Values mirror the design tokens exactly (coin/orange/mint hues, radii, type).
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import tw from '../../lib/tw';

const fmt = (n: number) => Number(n).toLocaleString('en-US');

// CoinGlyph — the simple loot coin (circle + star), the inline money mark. Matches
// the design's CoinGlyph (no dashed inner ring; that's the larger standalone coin).
export function CoinGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="20" fill="#FFC93C" />
      <Circle cx="24" cy="24" r="20" fill="none" stroke="#F0B315" strokeWidth="2.5" />
      <Path
        d="M24 15l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z"
        fill="#fff"
      />
    </Svg>
  );
}

type CoinSize = 'sm' | 'md' | 'lg';
type CoinTone = 'soft' | 'solid' | 'plain';

const COIN_SIZES: Record<CoinSize, { fs: number; coin: number; px: number; py: number }> = {
  sm: { fs: 14, coin: 15, px: 9, py: 4 },
  md: { fs: 16, coin: 18, px: 12, py: 6 },
  lg: { fs: 21, coin: 24, px: 16, py: 8 },
};
const COIN_TONES: Record<CoinTone, { bg: string; fg: string }> = {
  soft: { bg: 'bg-coin-soft', fg: 'text-coin-ink' },
  solid: { bg: 'bg-coin', fg: 'text-coin-ink' },
  plain: { bg: 'bg-transparent', fg: 'text-ink-900' },
};

// CoinBadge — coin glyph + loot amount, the universal money chip.
export function CoinBadge({
  amount,
  size = 'md',
  tone = 'soft',
  sign = false,
}: {
  amount: number;
  size?: CoinSize;
  tone?: CoinTone;
  sign?: boolean;
}) {
  const s = COIN_SIZES[size];
  const t = COIN_TONES[tone];
  const prefix = sign ? (amount >= 0 ? '+' : '−') : '';
  return (
    <View
      style={tw.style(`flex-row items-center self-start rounded-pill ${t.bg}`, {
        gap: 6,
        paddingLeft: s.px - 3,
        paddingRight: s.px,
        paddingVertical: s.py,
      })}
    >
      <CoinGlyph size={s.coin} />
      <Text style={tw.style(`font-number font-bold ${t.fg}`, { fontSize: s.fs })}>
        {prefix}
        {fmt(Math.abs(amount))}
      </Text>
    </View>
  );
}

type PillTone = 'orange' | 'mint' | 'indigo' | 'coin';
const PILL_TONES: Record<PillTone, { bg: string; edge: string; onCoin: boolean }> = {
  orange: { bg: 'bg-orange', edge: '#D85F06', onCoin: false },
  mint: { bg: 'bg-mint', edge: '#0E9E68', onCoin: false },
  indigo: { bg: 'bg-indigo', edge: '#444CCB', onCoin: false },
  coin: { bg: 'bg-coin', edge: '#F0B315', onCoin: true },
};

// BalancePill — the big wallet/savings hero. Chunky bottom "edge" (0 6px 0 strong)
// is emulated with a hard offset shadow, like the rest of the app's hero cards.
export function BalancePill({
  amount,
  label = 'Wallet',
  tone = 'orange',
  style,
}: {
  amount: number;
  label?: string;
  tone?: PillTone;
  style?: ViewStyle;
}) {
  const t = PILL_TONES[tone];
  const fg = t.onCoin ? 'text-coin-ink' : 'text-white';
  return (
    <View
      style={[
        tw.style(`gap-1 rounded-2xl px-6 py-5 ${t.bg}`, {
          shadowColor: t.edge,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        }),
        style,
      ]}
    >
      <Text
        style={tw.style(`font-sans font-extrabold uppercase tracking-wide text-[13px] ${fg}`, {
          opacity: t.onCoin ? 0.9 : 0.92,
        })}
      >
        {label}
      </Text>
      <View style={tw`flex-row items-center gap-2`}>
        <CoinGlyph size={30} />
        <Text style={tw.style(`font-display text-[40px] font-extrabold ${fg}`)}>{fmt(amount)}</Text>
      </View>
    </View>
  );
}

const FLAME =
  'M12 2c.5 3-2 4.5-2 7a2 2 0 0 0 4 0c0-.7-.2-1.3-.2-1.3 2 1.3 4.2 3.4 4.2 6.8a6 6 0 1 1-12 0c0-3 1.8-5 3-6.5C10.2 6.2 11.5 4.4 12 2z';

// StreakMeter — reading streak: flame medallion + "{days} day streak" + goal dots.
export function StreakMeter({
  days,
  goal = 7,
  label = 'day streak',
  style,
}: {
  days: number;
  goal?: number;
  label?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        tw.style('flex-row items-center gap-3.5 rounded-card bg-orange-soft px-4 py-4', {
          shadowColor: 'rgba(32,36,58,1)',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 4,
        }),
        style,
      ]}
    >
      <View
        style={tw.style('items-center justify-center rounded-full bg-orange', {
          width: 52,
          height: 52,
          shadowColor: '#FFC93C',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 6,
        })}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="#fff">
          <Path d={FLAME} />
        </Svg>
      </View>
      <View style={tw`min-w-0 flex-1 gap-1.5`}>
        <View style={tw`flex-row items-baseline gap-1.5`}>
          <Text style={tw`font-display text-[26px] font-extrabold text-orange-ink`}>{days}</Text>
          <Text style={tw`font-sans text-[14px] font-bold text-orange-strong`}>{label}</Text>
        </View>
        <View style={tw`flex-row gap-1.5`}>
          {Array.from({ length: goal }).map((_, i) => (
            <View
              key={i}
              style={tw.style('h-2 flex-1 rounded-pill', i < days ? 'bg-orange' : 'bg-orange-200')}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

type BarTone = 'mint' | 'indigo' | 'coin' | 'orange';
const BAR_FILL: Record<BarTone, string> = {
  mint: 'bg-mint',
  indigo: 'bg-indigo',
  coin: 'bg-coin',
  orange: 'bg-orange',
};

// ProgressBar — track + rounded fill. height/tone match the design.
export function ProgressBar({
  value,
  max = 100,
  tone = 'mint',
  height = 14,
}: {
  value: number;
  max?: number;
  tone?: BarTone;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={tw.style('w-full overflow-hidden rounded-pill bg-ink-100', { height })}>
      <View style={tw.style(`h-full rounded-pill ${BAR_FILL[tone]}`, { width: `${pct}%` })} />
    </View>
  );
}
