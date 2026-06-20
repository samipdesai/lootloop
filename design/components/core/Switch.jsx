import React from 'react';

/** loot loop Switch — chunky pill toggle. */
export function Switch({ checked = false, onChange, disabled = false, tone = 'mint', style = {} }) {
  const colors = { mint: 'var(--mint)', orange: 'var(--orange)', indigo: 'var(--indigo)' };
  const on = colors[tone] || colors.mint;
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: '56px', height: '32px', borderRadius: 'var(--radius-pill)',
        border: 'none', padding: '3px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? on : 'var(--ink-200)',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background var(--dur-base) var(--ease-out)',
        WebkitTapHighlightColor: 'transparent', ...style,
      }}
    >
      <span style={{
        width: '26px', height: '26px', borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 5px rgba(32,36,58,0.25)',
        transition: 'transform var(--dur-base) var(--ease-bounce)',
      }} />
    </button>
  );
}
