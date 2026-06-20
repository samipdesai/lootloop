import React from 'react';
import { CoinBadge } from './CoinBadge.jsx';

/** loot loop GoalTracker — savings goal card with progress + interest hint. */
export function GoalTracker({ title = 'Savings goal', saved = 0, target = 100, tone = 'mint', hint = null, style = {} }) {
  const tones = {
    mint:   { fill: 'var(--mint)', soft: 'var(--mint-soft)', ink: 'var(--mint-ink)' },
    indigo: { fill: 'var(--indigo)', soft: 'var(--indigo-soft)', ink: 'var(--indigo-ink)' },
    coin:   { fill: 'var(--coin)', soft: 'var(--coin-soft)', ink: 'var(--coin-ink)' },
  };
  const t = tones[tone] || tones.mint;
  const pct = Math.max(0, Math.min(100, (saved / target) * 100));
  return (
    <div style={{
      background: 'var(--surface-card)', borderRadius: 'var(--radius-card)',
      padding: '20px', boxShadow: 'var(--shadow-md)',
      display: 'flex', flexDirection: 'column', gap: '14px', ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h3)', color: 'var(--text-strong)' }}>{title}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            {Math.round(pct)}% there
          </span>
        </div>
        <CoinBadge amount={target} size="sm" />
      </div>
      <div style={{ width: '100%', height: 16, background: t.soft, borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: t.fill, borderRadius: 'var(--radius-pill)',
          transition: 'width var(--dur-slow) var(--ease-out)',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0 8px, transparent 8px 16px)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CoinBadge amount={saved} size="sm" tone="plain" />
        {hint && (
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--fs-caption)', color: t.ink, background: t.soft, padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
