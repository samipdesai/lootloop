import React from 'react';

/** loot loop ProgressBar — rounded track with animated fill. */
export function ProgressBar({ value = 0, max = 100, tone = 'mint', height = 14, showCoins = false, style = {} }) {
  const colors = {
    mint: 'var(--mint)', orange: 'var(--orange)', indigo: 'var(--indigo)', coin: 'var(--coin)',
  };
  const fill = colors[tone] || colors.mint;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{
      width: '100%', height, background: 'var(--ink-100)',
      borderRadius: 'var(--radius-pill)', overflow: 'hidden',
      position: 'relative', ...style,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: fill,
        borderRadius: 'var(--radius-pill)',
        transition: 'width var(--dur-slow) var(--ease-out)',
        backgroundImage: showCoins
          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0 8px, transparent 8px 16px)'
          : 'none',
      }} />
    </div>
  );
}
