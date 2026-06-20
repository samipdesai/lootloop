/* loot loop UI kit — Parent view (approval queue, kids, fulfillment) */
function Parent({ kids, approvals, purchases, onApprove, onReject, onExit }) {
  const { Icon, AppHeader, Screen } = window.LLKit;
  const { Card, CoinBadge, Button, Avatar, Badge } = window.LootLoopDesignSystem_0f5b5d;

  return (
    <>
      <AppHeader
        subtitle="Parent"
        title="Family"
        right={<button onClick={onExit} style={{ border: 'none', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-pill)', padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="repeat" size={16} />Kid view</button>}
      />
      <Screen>
        {/* Kids row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {kids.map((k) => (
            <Card key={k.name} elevation="sm" pad={14} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Avatar name={k.name} size={48} ring={k.active} />
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-strong)' }}>{k.name}</div>
              <CoinBadge amount={k.balance} size="sm" />
            </Card>
          ))}
        </div>

        {/* Approval queue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--text-strong)' }}>Approvals</span>
          {approvals.length > 0 && <Badge tone="orange" solid>{approvals.length}</Badge>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {approvals.length === 0 ? (
            <Card tone="mint" pad={20} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--mint-ink)' }}>All caught up! 🎉</Card>
          ) : approvals.map((a) => (
            <Card key={a.id} elevation="sm" pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: a.type === 'reading' ? 'var(--indigo-soft)' : 'var(--coin-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={a.type === 'reading' ? 'book-open' : 'circle-check-big'} size={22} color={a.type === 'reading' ? 'var(--indigo)' : 'var(--coin-ink)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)' }}>{a.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{a.kid} · {a.meta}</div>
                </div>
                <CoinBadge amount={a.points} size="sm" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" size="sm" block onClick={() => onReject(a.id)}>Reject</Button>
                <Button variant="mint" size="sm" block onClick={() => onApprove(a.id)} iconLeft={<Icon name="check" size={18} color="#fff" />}>Approve & pay</Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Fulfillment */}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--text-strong)', marginBottom: 10 }}>To give out</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {purchases.map((p) => (
            <Card key={p.id} elevation="sm" pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }} aria-hidden="true">{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)' }}>{p.title}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{p.kid} bought this</div>
              </div>
              <Button variant="indigo" size="sm">Mark given</Button>
            </Card>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Screen>
    </>
  );
}
window.LLKit = Object.assign(window.LLKit || {}, { Parent });
