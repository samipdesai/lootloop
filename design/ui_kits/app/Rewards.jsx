/* loot loop UI kit — Reward store screen */
function Rewards({ balance, rewards, onBuy }) {
  const { AppHeader, Screen } = window.LLKit;
  const { CoinBadge, RewardCard, Card } = window.LootLoopDesignSystem_0f5b5d;
  return (
    <>
      <AppHeader
        subtitle="Spend your loot"
        title="Reward store"
        right={<CoinBadge amount={balance} tone="solid" />}
      />
      <Screen>
        <Card tone="indigo" pad={16} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 30 }} aria-hidden="true">🛍️</span>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--indigo-ink)', lineHeight: 1.35 }}>
            Tap a reward to buy it. Loot comes out of your wallet — saving up unlocks the big stuff!
          </div>
        </Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {rewards.map((r) => (
            <RewardCard key={r.id} title={r.title} cost={r.cost} emoji={r.emoji} balance={balance} onBuy={() => onBuy(r)} />
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Screen>
    </>
  );
}
window.LLKit = Object.assign(window.LLKit || {}, { Rewards });
