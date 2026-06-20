/* loot loop UI kit — Home / dashboard screen */
function Home({ kidName, balance, savings, streak, chores, onTab, onComplete, onParent }) {
  const { Icon, AppHeader, Screen } = window.LLKit;
  const { BalancePill, StreakMeter, CoinBadge, Card, ProgressBar, Button } = window.LootLoopDesignSystem_0f5b5d;
  const done = chores.filter((c) => c.done).length;
  const next = chores.filter((c) => !c.done).slice(0, 2);

  return (
    <>
      <AppHeader
        subtitle="Hi there"
        title={`${kidName} 👋`}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onParent} title="Grown-ups" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={18} color="var(--text-muted)" />
            </button>
            <img src="../../assets/looty.svg" width="50" height="50" alt="Looty" style={{ filter: 'drop-shadow(0 4px 8px rgba(240,179,21,0.4))' }} />
          </div>
        )}
      />
      <Screen>
        <BalancePill label="Wallet" amount={balance} tone="orange" style={{ marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Card tone="mint" elevation="sm" pad={14} onClick={() => onTab('savings')} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="piggy-bank" size={26} color="var(--mint-ink)" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--mint-ink)', opacity: .8 }}>Savings</div>
              <CoinBadge amount={savings} size="sm" tone="plain" />
            </div>
          </Card>
          <Card tone="coin" elevation="sm" pad={14} onClick={() => onTab('rewards')} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="gift" size={26} color="var(--coin-ink)" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--coin-ink)', opacity: .85 }}>Store</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--coin-ink)' }}>Spend loot</div>
            </div>
          </Card>
        </div>

        <StreakMeter days={streak} goal={7} style={{ marginBottom: 18 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--text-strong)' }}>Today's chores</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>{done}/{chores.length} done</span>
        </div>
        <ProgressBar value={done} max={chores.length} tone="mint" style={{ marginBottom: 14 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {next.length === 0 ? (
            <Card tone="mint" pad={18} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--mint-ink)' }}>
              🎉 All done for today — nice work!
            </Card>
          ) : next.map((c) => (
            <Card key={c.id} elevation="sm" pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--indigo-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={c.icon} size={22} color="var(--indigo)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)' }}>{c.title}</div>
                <CoinBadge amount={c.points} size="sm" tone="plain" />
              </div>
              <Button size="sm" variant="mint" onClick={() => onComplete(c.id)}>Done</Button>
            </Card>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Screen>
    </>
  );
}
window.LLKit = Object.assign(window.LLKit || {}, { Home });
