import React from 'react';

/**
 * loot loop Button — tactile, candy-bright, with a chunky 3D bottom edge
 * that visibly depresses on press.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  style = {},
  ...rest
}) {
  const palettes = {
    primary: { bg: 'var(--orange)', bgStrong: 'var(--orange-strong)', fg: '#fff' },
    mint:    { bg: 'var(--mint)', bgStrong: 'var(--mint-strong)', fg: '#fff' },
    indigo:   { bg: 'var(--indigo)', bgStrong: 'var(--indigo-strong)', fg: '#fff' },
    coin:    { bg: 'var(--coin)', bgStrong: 'var(--coin-strong)', fg: 'var(--coin-ink)' },
  };
  const sizes = {
    sm: { h: 'var(--control-h-sm)', px: '16px', fs: 'var(--fs-body-sm)', edge: 3 },
    md: { h: 'var(--control-h)', px: '22px', fs: 'var(--fs-body)', edge: 4 },
    lg: { h: 'var(--control-h-lg)', px: '28px', fs: 'var(--fs-body-lg)', edge: 4 },
  };
  const s = sizes[size] || sizes.md;

  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';
  const p = palettes[variant] || palettes.primary;

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: s.fs,
    height: s.h, padding: `0 ${s.px}`, width: block ? '100%' : 'auto',
    border: 'none', borderRadius: 'var(--radius-pill)', cursor: disabled ? 'not-allowed' : 'pointer',
    lineHeight: 1, whiteSpace: 'nowrap', userSelect: 'none',
    transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast)',
    WebkitTapHighlightColor: 'transparent',
  };

  let variantStyle;
  if (disabled) {
    variantStyle = { background: 'var(--ink-200)', color: 'var(--ink-400)', boxShadow: 'none' };
  } else if (isGhost) {
    variantStyle = { background: 'transparent', color: 'var(--brand-strong)', boxShadow: 'none' };
  } else if (isSecondary) {
    variantStyle = { background: 'var(--surface-card)', color: 'var(--text-strong)', boxShadow: `inset 0 0 0 2px var(--border), 0 ${s.edge}px 0 var(--ink-200)` };
  } else {
    variantStyle = { background: p.bg, color: p.fg, boxShadow: `0 ${s.edge}px 0 ${p.bgStrong}` };
  }

  const press = (e, down) => {
    if (disabled || isGhost) return;
    const el = e.currentTarget;
    if (down) { el.style.transform = 'translateY(2px)'; el.style.boxShadow = el.style.boxShadow.replace(/0 \d+px 0/, '0 2px 0'); }
    else { el.style.transform = ''; el.style.boxShadow = ''; }
  };

  return (
    <button
      disabled={disabled}
      style={{ ...base, ...variantStyle, ...style }}
      onMouseDown={(e) => press(e, true)}
      onMouseUp={(e) => press(e, false)}
      onMouseLeave={(e) => press(e, false)}
      onTouchStart={(e) => press(e, true)}
      onTouchEnd={(e) => press(e, false)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
