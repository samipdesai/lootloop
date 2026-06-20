import React from 'react';

/** Inline coin glyph — the canonical loot/money symbol. */
export function CoinGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="24" cy="24" r="20" fill="#FFC93C" />
      <circle cx="24" cy="24" r="20" stroke="#F0B315" strokeWidth="2.5" />
      <path d="M24 15l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z" fill="#fff" />
    </svg>
  );
}

const fmt = (n) => Number(n).toLocaleString('en-US');

/** loot loop CoinBadge — a coin glyph + loot amount, the universal money chip. */
export function CoinBadge({ amount = 0, size = 'md', tone = 'soft', sign = false, style = {} }) {
  const sizes = {
    sm: { fs: 'var(--fs-body-sm)', coin: 15, pad: '4px 9px 4px 6px' },
    md: { fs: 'var(--fs-body)', coin: 18, pad: '6px 12px 6px 8px' },
    lg: { fs: 'var(--fs-h3)', coin: 24, pad: '8px 16px 8px 10px' },
  };
  const s = sizes[size] || sizes.md;
  const tones = {
    soft:  { bg: 'var(--coin-soft)', fg: 'var(--coin-ink)' },
    solid: { bg: 'var(--coin)', fg: 'var(--coin-ink)' },
    plain: { bg: 'transparent', fg: 'var(--text-strong)' },
  };
  const t = tones[tone] || tones.soft;
  const prefix = sign ? (amount >= 0 ? '+' : '−') : '';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: t.bg, color: t.fg, padding: t.pad,
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-number)', fontWeight: 700, fontSize: s.fs, lineHeight: 1,
      ...style,
    }}>
      <CoinGlyph size={s.coin} />
      {prefix}{fmt(Math.abs(amount))}
    </span>
  );
}
