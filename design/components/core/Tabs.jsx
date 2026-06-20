import React from 'react';

/** loot loop Tabs — pill segmented control. */
export function Tabs({ tabs = [], value, onChange, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', gap: '4px', padding: '4px',
      background: 'var(--ink-100)', borderRadius: 'var(--radius-pill)',
      width: '100%', boxSizing: 'border-box', ...style,
    }}>
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.value;
        const label = typeof t === 'string' ? t : t.label;
        const active = key === value;
        return (
          <button
            key={key}
            onClick={() => onChange && onChange(key)}
            style={{
              flex: 1, height: '40px', border: 'none', borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--fs-body-sm)',
              background: active ? 'var(--surface-card)' : 'transparent',
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--dur-base) var(--ease-out)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
