/* loot loop UI kit — Chores screen (claim, complete, pending approval) */
function Chores({ chores, onComplete }) {
  const { Icon, AppHeader, Screen } = window.LLKit;
  const { Tabs, Card, CoinBadge, Button, Badge } = window.LootLoopDesignSystem_0f5b5d;
  const [tab, setTab] = React.useState('todo');

  const todo = chores.filter((c) => !c.done && c.status !== 'pending');
  const pending = chores.filter((c) => c.status === 'pending');
  const done = chores.filter((c) => c.done);
  const list = tab === 'todo' ? todo : done;

  return (
    <>
      <AppHeader subtitle="Earn loot" title="Chores" />
      <Screen>
        <Tabs tabs={[{ value: 'todo', label: `To-do (${todo.length + pending.length})` }, { value: 'done', label: `Done (${done.length})` }]} value={tab} onChange={setTab} style={{ marginBottom: 16 }} />

        {tab === 'todo' && pending.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--warning-ink)', marginBottom: 8 }}>Waiting for approval</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map((c) => (
                <Card key={c.id} tone="coin" elevation="sm" pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={c.icon} size={22} color="var(--coin-ink)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--coin-ink)' }}>{c.title}</div>
                    <CoinBadge amount={c.points} size="sm" tone="plain" />
                  </div>
                  <Badge tone="warning" solid>Pending</Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 ? (
            <Card pad={22} style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
              {tab === 'todo' ? 'Nothing left — you crushed it! 🎉' : 'Finish a chore to see it here.'}
            </Card>
          ) : list.map((c) => (
            <Card key={c.id} elevation="sm" pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: c.done ? 0.7 : 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: c.done ? 'var(--mint-soft)' : 'var(--indigo-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={c.done ? 'check' : c.icon} size={22} color={c.done ? 'var(--mint-strong)' : 'var(--indigo)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)', textDecoration: c.done ? 'line-through' : 'none', textDecorationColor: 'var(--ink-300)' }}>{c.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CoinBadge amount={c.points} size="sm" tone="plain" />
                  {c.shared && <Badge tone="indigo">shared</Badge>}
                </div>
              </div>
              {!c.done && <Button size="sm" variant="mint" onClick={() => onComplete(c.id)}>Mark done</Button>}
              {c.done && <Icon name="circle-check-big" size={26} color="var(--mint)" />}
            </Card>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Screen>
    </>
  );
}
window.LLKit = Object.assign(window.LLKit || {}, { Chores });
