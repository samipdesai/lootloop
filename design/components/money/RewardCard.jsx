import React from 'react';
import { CoinBadge } from './CoinBadge.jsx';
import { Button } from '../core/Button.jsx';

/** loot loop RewardCard — a reward-store item tile. */
export function RewardCard({
  title = 'Reward', cost = 0, emoji = '🎁', balance = null,
  imageSrc = null, onBuy, style = {},
}) {
  const affordable = balance == null || balance >= cost;
  return (
    <div style={{
      background: 'var(--surface-card)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', ...style,
    }}>
      <div style={{
        height: 104, background: 'var(--indigo-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52, lineHeight: 1,
      }}>
        {imageSrc ? <img src={imageSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden="true">{emoji}</span>}
      </div>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-body-lg)', color: 'var(--text-strong)', lineHeight: 1.15 }}>{title}</span>
          <CoinBadge amount={cost} size="sm" />
        </div>
        <Button variant={affordable ? 'primary' : 'secondary'} size="sm" block disabled={!affordable} onClick={onBuy}>
          {affordable ? 'Buy' : 'Need more loot'}
        </Button>
      </div>
    </div>
  );
}
