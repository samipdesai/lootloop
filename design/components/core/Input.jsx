import React from 'react';

/** loot loop Input — rounded, friendly text field with optional icon + label. */
export function Input({
  label,
  hint,
  error,
  iconLeft = null,
  suffix = null,
  style = {},
  id,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || `ll-input-${Math.random().toString(36).slice(2, 8)}`;
  const ring = error ? 'var(--danger)' : focus ? 'var(--indigo)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={{
          fontFamily: 'var(--font-body)', fontWeight: 700,
          fontSize: 'var(--fs-body-sm)', color: 'var(--text-strong)',
        }}>{label}</label>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        height: 'var(--control-h)', padding: '0 16px',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
        boxShadow: `inset 0 0 0 2px ${ring}${focus && !error ? ', var(--focus-ring)' : ''}`,
        transition: 'box-shadow var(--dur-fast) var(--ease-out)',
        ...style,
      }}>
        {iconLeft && <span style={{ color: 'var(--text-faint)', display: 'flex' }}>{iconLeft}</span>}
        <input
          id={inputId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--fs-body)',
            color: 'var(--text-strong)', minWidth: 0,
          }}
          {...rest}
        />
        {suffix && <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-body)' }}>{suffix}</span>}
      </div>
      {(hint || error) && (
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 'var(--fs-caption)', fontWeight: 600,
          color: error ? 'var(--danger-ink)' : 'var(--text-muted)',
        }}>{error || hint}</span>
      )}
    </div>
  );
}
