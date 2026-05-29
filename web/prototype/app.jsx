// app.jsx — main App component, theme + screen routing + tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "sidebarMode": "expanded",
  "cardStyle": "elevated",
  "chartKind": "area",
  "density": "regular",
  "palette": ["#22D3EE", "#8B5CF6", "#A3E635"]
}/*EDITMODE-END*/;

// Persist tweaks to localStorage when running standalone (downloaded / exported)
// so the user's theme/density choices survive reload, AND auto-open the Tweaks
// panel so users discover it without needing the editor toolbar.
const PERSIST_KEY = 'roslib-tweaks-v1';
const IS_STANDALONE = (() => { try { return window === window.top; } catch (e) { return true; } })();

function getInitialTweaks() {
  if (!IS_STANDALONE) return TWEAK_DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || '{}');
    return { ...TWEAK_DEFAULTS, ...saved };
  } catch (e) {
    return TWEAK_DEFAULTS;
  }
}

function App() {
  const [t, setTweak] = useTweaks(getInitialTweaks());

  // Standalone-only behavior: persist + auto-show Tweaks panel.
  React.useEffect(() => {
    if (!IS_STANDALONE) return;
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(t)); } catch (e) {}
  }, [t]);

  React.useEffect(() => {
    if (!IS_STANDALONE) return;
    const timer = setTimeout(() => {
      window.postMessage({ type: '__activate_edit_mode' }, '*');
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  const [screen, setScreen] = React.useState(() => {
    const h = window.location.hash.replace('#','');
    return ['overview','users','voucher','sessions','profiles','ppp','network','reports','system'].includes(h) ? h : 'overview';
  });
  const [device, setDevice] = React.useState('rb-main');

  React.useEffect(() => {
    window.location.hash = screen;
  }, [screen]);

  // sync palette to CSS vars
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-density', t.density);
    document.documentElement.setAttribute('data-cardstyle', t.cardStyle);
    if (Array.isArray(t.palette)) {
      const [cyan, violet, lime] = t.palette;
      document.documentElement.style.setProperty('--accent-cyan', cyan);
      document.documentElement.style.setProperty('--accent-violet', violet);
      document.documentElement.style.setProperty('--accent-lime', lime);
      // soft variants — derive with rgba from hex
      const soft = (hex, a) => {
        const c = hex.replace('#','');
        const r = parseInt(c.substr(0,2),16);
        const g = parseInt(c.substr(2,2),16);
        const b = parseInt(c.substr(4,2),16);
        return `rgba(${r},${g},${b},${a})`;
      };
      document.documentElement.style.setProperty('--accent-cyan-soft', soft(cyan, 0.14));
      document.documentElement.style.setProperty('--accent-violet-soft', soft(violet, 0.14));
      document.documentElement.style.setProperty('--accent-lime-soft', soft(lime, 0.18));
    }
  }, [t.theme, t.density, t.cardStyle, t.palette]);

  const toggleSidebar = () => {
    const cycle = { expanded: 'icon', icon: 'collapsed', collapsed: 'expanded' };
    setTweak('sidebarMode', cycle[t.sidebarMode] || 'expanded');
  };

  const Screen = {
    overview: OverviewScreen,
    users: HotspotUsersScreen,
    voucher: VoucherScreen,
    sessions: SessionsScreen,
    profiles: HotspotProfilesScreen,
    ppp: PPPScreen,
    network: NetworkScreen,
    reports: ReportsScreen,
    system: SystemScreen,
  }[screen];

  return (
    <div className="app">
      <Sidebar
        mode={t.sidebarMode}
        screen={screen}
        onScreen={setScreen}
        device={device}
        onDevice={setDevice}
      />
      <div className="main">
        <Topbar
          device={device}
          theme={t.theme}
          onTheme={v => setTweak('theme', v)}
          onToggleSidebar={toggleSidebar}
        />
        <div className="scroll-area">
          {Screen ? (
            <Screen device={device} chartKind={t.chartKind} onScreen={setScreen} key={screen} />
          ) : (
            <Placeholder screen={screen} />
          )}
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Tampilan" />
        <TweakRadio label="Tema" value={t.theme}
          options={['dark','light']}
          onChange={v => setTweak('theme', v)} />
        <TweakRadio label="Density" value={t.density}
          options={['compact','regular','comfy']}
          onChange={v => setTweak('density', v)} />

        <TweakSection label="Sidebar" />
        <TweakRadio label="Mode" value={t.sidebarMode}
          options={[{value:'expanded',label:'Expanded'},{value:'icon',label:'Icon'},{value:'collapsed',label:'Hidden'}]}
          onChange={v => setTweak('sidebarMode', v)} />

        <TweakSection label="Cards & Charts" />
        <TweakRadio label="Card style" value={t.cardStyle}
          options={['flat','elevated','bordered']}
          onChange={v => setTweak('cardStyle', v)} />
        <TweakRadio label="Chart" value={t.chartKind}
          options={[{value:'area',label:'Area'},{value:'line',label:'Line'},{value:'bar',label:'Bar'}]}
          onChange={v => setTweak('chartKind', v)} />

        <TweakSection label="Palette" />
        <TweakColor label="Accent" value={t.palette}
          options={[
            ['#22D3EE', '#8B5CF6', '#A3E635'],
            ['#3B82F6', '#06B6D4', '#10B981'],
            ['#F97316', '#FACC15', '#EF4444'],
            ['#1E40AF', '#0EA5E9', '#64748B'],
            ['#84CC16', '#14B8A6', '#E7E5E4'],
          ]}
          onChange={v => setTweak('palette', v)} />
      </TweaksPanel>
    </div>
  );
}

function Placeholder({ screen }) {
  const item = NAV.find(n => n.id === screen);
  const IconCmp = (item && Icon[item.icon]) || Icon.Activity;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 'calc(100vh - 120px)', textAlign:'center', color: 'var(--muted)' }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'var(--accent-cyan-soft)',
        color: 'var(--accent-cyan)',
        display:'flex', alignItems:'center', justifyContent:'center',
        marginBottom: 18,
      }}>
        <IconCmp size={36} />
      </div>
      <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20, fontWeight: 600 }}>{item?.label || screen}</h2>
      <p style={{ marginTop: 8, maxWidth: 360, fontSize: 13.5 }}>
        Section ini di luar scope mockup hi-fi saat ini. Endpoint API tersedia — design tinggal dirakit.
      </p>
      <div style={{ marginTop: 18, display:'flex', gap: 8 }}>
        <button className="btn btn-sm"><Icon.Sparkles size={13}/>Request design</button>
        <button className="btn btn-primary btn-sm"><Icon.ArrowUpRight size={13}/>Lihat API docs</button>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
