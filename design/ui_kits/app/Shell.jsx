/* loot loop UI kit — app shell: phone frame, header, bottom nav, Icon helper.
   Exports to window.LLKit so sibling babel scripts can share them. */

function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 2.4, style = {} }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: { width: size, height: size, stroke: color, 'stroke-width': strokeWidth },
        nameAttr: 'data-lucide',
      });
    }
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} style={{ display: 'inline-flex', width: size, height: size, ...style }} aria-hidden="true" />;
}

/** Phone canvas — soft rounded screen on the orange-grey page. */
function PhoneFrame({ children, bg = 'var(--surface-page)', theme = 'light', onToggleTheme }) {
  return (
    <div data-theme={theme} style={{
      width: 390, height: 800, background: bg, borderRadius: 44,
      boxShadow: '0 30px 80px rgba(32,36,58,0.28), inset 0 0 0 1px rgba(255,255,255,0.6)',
      overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-body)',
    }}>
      {/* status bar */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 26px',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-strong)',
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {onToggleTheme && (
            <button onClick={onToggleTheme} aria-label="Toggle dark mode" style={{
              border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', color: 'var(--text-strong)',
            }}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} color="var(--text-strong)" /></button>
          )}
          <Icon name="signal" size={16} /><Icon name="wifi" size={16} /><Icon name="battery-full" size={18} />
        </span>
      </div>
      {children}
    </div>
  );
}

/** App top header with greeting + avatar / action. */
function AppHeader({ title, subtitle, right = null, onBack = null, color = 'var(--text-strong)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
      {onBack && (
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><Icon name="chevron-left" size={22} color="var(--text-strong)" /></button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {subtitle && <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{subtitle}</div>}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color, lineHeight: 1.1 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

/** Bottom tab navigation. */
function BottomNav({ tab, onTab }) {
  const tabs = [
    { id: 'home', icon: 'house', label: 'Home' },
    { id: 'chores', icon: 'circle-check-big', label: 'Chores' },
    { id: 'rewards', icon: 'gift', label: 'Store' },
    { id: 'savings', icon: 'piggy-bank', label: 'Savings' },
  ];
  return (
    <div style={{
      flexShrink: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '10px 12px 22px', background: 'var(--surface-card)',
      boxShadow: '0 -6px 24px rgba(32,36,58,0.08)', borderRadius: '28px 28px 0 0',
    }}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => onTab(t.id)} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 14px', borderRadius: 16, minWidth: 64,
            color: active ? 'var(--orange)' : 'var(--text-faint)',
          }}>
            <Icon name={t.icon} size={26} color={active ? 'var(--orange)' : 'var(--ink-400)'} strokeWidth={active ? 2.6 : 2.2} />
            <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Scrollable content region between header and nav. */
function Screen({ children, style = {} }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 20px 20px', ...style }}>
      {children}
    </div>
  );
}

Object.assign(window, { LLKit: Object.assign(window.LLKit || {}, {
  Icon, PhoneFrame, AppHeader, BottomNav, Screen,
}) });
