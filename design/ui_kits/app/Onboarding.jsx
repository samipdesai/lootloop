/* loot loop UI kit — Onboarding / kid sign-in */
function Onboarding({ onEnter }) {
  const { Icon, PhoneFrame } = window.LLKit;
  const { Button } = window.LootLoopDesignSystem_0f5b5d;
  const [step, setStep] = React.useState('welcome');
  const [pin, setPin] = React.useState('');

  const press = (n) => {
    if (pin.length >= 4) return;
    const next = pin + n;
    setPin(next);
    if (next.length === 4) setTimeout(onEnter, 350);
  };

  if (step === 'welcome') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', gap: 18 }}>
        <img src="../../assets/looty.svg" width="130" alt="Looty" style={{ filter: 'drop-shadow(0 12px 24px rgba(240,179,21,0.45))' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: 'var(--text-strong)', lineHeight: 1.1 }}>
          Hi, I'm Looty!
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.45, maxWidth: 280 }}>
          Do chores, read, and earn loot. Then save it, watch it grow, and spend it on stuff you love.
        </div>
        <Button variant="primary" size="lg" block onClick={() => setStep('pin')} style={{ marginTop: 12 }}>Let's go!</Button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', gap: 22 }}>
      <img src="../../assets/coin.svg" width="56" alt="" />
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-strong)' }}>Enter your PIN</div>
      <div style={{ display: 'flex', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < pin.length ? 'var(--orange)' : 'var(--ink-200)',
            transition: 'background var(--dur-base) var(--ease-bounce)',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: 240 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} onClick={() => press(String(n))} style={padBtn}>{n}</button>
        ))}
        <span />
        <button onClick={() => press('0')} style={padBtn}>0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} style={{ ...padBtn, background: 'transparent', boxShadow: 'none' }}>
          <Icon name="delete" size={26} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
}
const padBtn = {
  height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)',
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--text-strong)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
window.LLKit = Object.assign(window.LLKit || {}, { Onboarding });
