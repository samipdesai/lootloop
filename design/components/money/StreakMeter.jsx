import React from 'react';

/** loot loop StreakMeter — flame + day count with a row of day dots. */
export function StreakMeter({ days = 0, goal = 7, label = 'day streak', style = {} }) {
  const dots = Array.from({ length: goal });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      background: 'var(--orange-soft)', color: 'var(--orange-ink)',
      borderRadius: 'var(--radius-card)', padding: '16px 18px', ...style,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', background: 'var(--orange)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: 'var(--shadow-coin)',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M12 2c.5 3-2 4.5-2 7a2 2 0 0 0 4 0c0-.7-.2-1.3-.2-1.3 2 1.3 4.2 3.4 4.2 6.8a6 6 0 1 1-12 0c0-3 1.8-5 3-6.5C10.2 6.2 11.5 4.4 12 2z"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-h2)', lineHeight: 1 }}>{days}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--fs-body-sm)' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {dots.map((_, i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i < days ? 'var(--orange)' : 'var(--orange-200)',
              opacity: i < days ? 1 : 0.5,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
