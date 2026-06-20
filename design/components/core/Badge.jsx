import React from 'react';

/** loot loop Badge — small status / category pill. */
export function Badge({ children, tone = 'neutral', solid = false, style = {}, ...rest }) {
  const map = {
    neutral: { soft: 'var(--ink-100)', ink: 'var(--ink-700)', base: 'var(--ink-500)' },
    orange:  { soft: 'var(--orange-soft)', ink: 'var(--orange-ink)', base: 'var(--orange)' },
    mint:    { soft: 'var(--mint-soft)', ink: 'var(--mint-ink)', base: 'var(--mint-strong)' },
    indigo:  { soft: 'var(--indigo-soft)', ink: 'var(--indigo-ink)', base: 'var(--indigo)' },
    coin:    { soft: 'var(--coin-soft)', ink: 'var(--coin-ink)', base: 'var(--coin-strong)' },
    success: { soft: 'var(--success-soft)', ink: 'var(--success-ink)', base: 'var(--success)' },
    warning: { soft: 'var(--warning-soft)', ink: 'var(--warning-ink)', base: 'var(--warning)' },
    danger:  { soft: 'var(--danger-soft)', ink: 'var(--danger-ink)', base: 'var(--danger)' },
  };
  const c = map[tone] || map.neutral;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontFamily: 'var(--font-body)', fontWeight: 800,
        fontSize: 'var(--fs-caption)', lineHeight: 1,
        padding: '5px 10px', borderRadius: 'var(--radius-pill)',
        background: solid ? c.base : c.soft,
        color: solid ? '#fff' : c.ink,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
