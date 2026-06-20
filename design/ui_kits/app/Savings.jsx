/* loot loop UI kit — Savings & compound interest screen */
function Savings({ balance, savings, onTransfer }) {
  const { Icon, AppHeader, Screen } = window.LLKit;
  const { BalancePill, GoalTracker, CoinBadge, Card, Button } = window.LootLoopDesignSystem_0f5b5d;
  const RATE = 0.05; // 5% monthly — teaching rate
  const [amount, setAmount] = React.useState(50);
  const step = (d) => setAmount((a) => Math.max(0, Math.min(balance, a + d)));
  const projected = Math.round((savings + amount) * RATE);

  return (
    <>
      <AppHeader subtitle="Grow your loot" title="Savings" />
      <Screen>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <BalancePill label="Savings" amount={savings} tone="mint" coins={22} style={{ flex: 1, padding: '16px 18px' }} />
          <Card elevation="sm" pad={16} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Wallet</span>
            <CoinBadge amount={balance} size="md" tone="plain" />
          </Card>
        </div>

        {/* Interest teacher */}
        <Card tone="mint" pad={18} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="trending-up" size={22} color="var(--mint-ink)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--mint-ink)' }}>Move loot to savings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <button onClick={() => step(-10)} style={stepBtn}><Icon name="minus" size={22} color="var(--mint-ink)" /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: 'var(--mint-ink)', lineHeight: 1 }}>{amount}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mint-ink)', opacity: .7 }}>loot</div>
            </div>
            <button onClick={() => step(10)} style={stepBtn}><Icon name="plus" size={22} color="var(--mint-ink)" /></button>
          </div>
          <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }} aria-hidden="true">✨</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint-ink)', lineHeight: 1.35 }}>
              Save it and earn <b>★ {projected}</b> in interest next month — free loot, just for waiting!
            </div>
          </div>
          <Button variant="mint" block disabled={amount <= 0 || amount > balance} onClick={() => { onTransfer(amount); setAmount(50); }}>
            Move {amount} to savings
          </Button>
        </Card>

        <GoalTracker title="New skateboard" saved={savings} target={1200} hint={`+★ ${Math.round(savings * RATE)}/mo`} style={{ marginBottom: 16 }} />

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text-strong)', marginBottom: 10 }}>Recent</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: 'trending-up', label: 'Monthly interest', delta: 12, tone: 'mint' },
            { icon: 'arrow-down', label: 'Deposit from wallet', delta: 100, tone: 'mint' },
            { icon: 'arrow-up', label: 'Withdraw to wallet', delta: -40, tone: 'ink' },
          ].map((t, i) => (
            <Card key={i} elevation="sm" pad={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: t.delta >= 0 ? 'var(--mint-soft)' : 'var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={20} color={t.delta >= 0 ? 'var(--mint-strong)' : 'var(--ink-500)'} />
              </div>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text-body)' }}>{t.label}</span>
              <CoinBadge amount={t.delta} size="sm" tone="plain" sign />
            </Card>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Screen>
    </>
  );
}
const stepBtn = {
  width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
window.LLKit = Object.assign(window.LLKit || {}, { Savings });
