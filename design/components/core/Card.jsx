import React from 'react';

/** loot loop Card — soft white surface with big friendly corners. */
export function Card({
  children,
  tone = 'plain',
  elevation = 'md',
  pad = 20,
  onClick,
  style = {},
  ...rest
}) {
  const tones = {
    plain:   { bg: 'var(--surface-card)', fg: 'var(--text-body)', ring: 'none' },
    orange:  { bg: 'var(--orange-soft)', fg: 'var(--orange-ink)', ring: 'none' },
    mint:    { bg: 'var(--mint-soft)', fg: 'var(--mint-ink)', ring: 'none' },
    indigo:  { bg: 'var(--indigo-soft)', fg: 'var(--indigo-ink)', ring: 'none' },
    coin:    { bg: 'var(--coin-soft)', fg: 'var(--coin-ink)', ring: 'none' },
    outline: { bg: 'var(--surface-card)', fg: 'var(--text-body)', ring: 'inset 0 0 0 2px var(--border)' },
  };
  const shadows = {
    none: 'none', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)',
  };
  const t = tones[tone] || tones.plain;

  return (
    <div
      onClick={onClick}
      style={{
        background: t.bg,
        color: t.fg,
        borderRadius: 'var(--radius-card)',
        padding: typeof pad === 'number' ? `${pad}px` : pad,
        boxShadow: t.ring === 'none' ? shadows[elevation] : `${t.ring}, ${shadows[elevation]}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
