import React from 'react';

/** loot loop Avatar — round, colorful kid avatar with initial fallback. */
export function Avatar({ name = '', src = null, size = 48, tone, ring = false, style = {} }) {
  const tones = ['var(--orange)', 'var(--indigo)', 'var(--mint)', 'var(--orange)', 'var(--coin-strong)'];
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const pick = tone || tones[(initial.charCodeAt(0) || 0) % tones.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: src ? 'var(--ink-100)' : pick,
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.42,
      overflow: 'hidden', flexShrink: 0,
      boxShadow: ring ? '0 0 0 3px var(--surface-card), 0 0 0 6px var(--coin)' : 'none',
      ...style,
    }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  );
}
