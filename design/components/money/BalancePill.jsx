import React from 'react';
import { CoinGlyph } from './CoinBadge.jsx';

const fmt = (n) => Number(n).toLocaleString('en-US');

/** loot loop BalancePill — the hero wallet/savings balance display. */
export function BalancePill({ amount = 0, label = 'Wallet', tone = 'orange', coins = 28, style = {} }) {
  const tones = {
    orange: { bg: 'var(--orange)', edge: 'var(--orange-strong)' },
    mint:   { bg: 'var(--mint)', edge: 'var(--mint-strong)' },
    indigo: { bg: 'var(--indigo)', edge: 'var(--indigo-strong)' },
    coin:   { bg: 'var(--coin)', edge: 'var(--coin-strong)' },
  };
  const t = tones[tone] || tones.orange;
  const onCoin = tone === 'coin';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '4px',
      background: t.bg, color: onCoin ? 'var(--coin-ink)' : '#fff',
      borderRadius: 'var(--radius-2xl)', padding: '20px 24px',
      boxShadow: `0 6px 0 ${t.edge}, var(--shadow-md)`,
      ...style,
    }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--fs-label)',
        letterSpacing: 'var(--ls-label)', textTransform: 'uppercase',
        opacity: 0.85,
      }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CoinGlyph size={coins} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-display)', lineHeight: 1 }}>
          {fmt(amount)}
        </span>
      </div>
    </div>
  );
}
