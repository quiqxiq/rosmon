// shell.jsx — Sidebar (device list + nav) and Topbar.

function BrandMark({ small }) {
  // wordmark with "/" hint
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
      <div style={{
        position: 'relative',
        width: 30, height: 30, borderRadius: 9,
        background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: '0 4px 16px rgba(34,211,238,0.35)',
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06121A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12 L8 7 L13 12 L8 17 Z" />
          <path d="M11 12 L16 7 L21 12 L16 17 Z" />
        </svg>
      </div>
      {!small && (
        <div style={{ display:'flex', flexDirection:'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>roslib<span style={{ color: 'var(--accent-cyan)' }}>/</span>admin</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.02em' }}>RouterOS · Mikhmon</span>
        </div>
      )}
    </div>
  );
}

function Sidebar({ mode, screen, onScreen, device, onDevice, density }) {
  const compact = mode === 'icon';
  return (
    <aside className="sb" data-mode={mode}>
      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', padding: '16px 16px 12px', height: 60 }}>
        <BrandMark small={compact} />
      </div>

      {/* Devices */}
      {!compact && (
        <div style={{ padding: '8px 12px 4px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '6px 4px 6px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Devices</span>
            <button className="btn btn-ghost btn-xs" title="Tambah device">
              <Icon.Plus size={12} />
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 2 }}>
            {DEVICES.map(d => (
              <DeviceRow key={d.id} device={d} active={d.id === device} onClick={()=>onDevice(d.id)} />
            ))}
          </div>
        </div>
      )}

      {!compact && <div className="divider" style={{ margin: '12px 16px' }} />}

      {/* Nav */}
      <div style={{ padding: compact ? '8px 10px' : '0 12px', display:'flex', flexDirection:'column', gap: 2, flex: 1, overflow: 'auto' }}>
        {!compact && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px' }}>Menu</div>}
        {NAV.map(n => (
          <NavItem key={n.id} item={n} active={screen === n.id} compact={compact} onClick={()=>onScreen(n.id)} />
        ))}
      </div>

      {/* User card */}
      <div style={{ padding: compact ? 10 : 12, borderTop: '1px solid var(--border)' }}>
        {compact ? (
          <div style={{ display:'flex', justifyContent:'center' }}>
            <Avatar name="Rendra Admin" size={32} />
          </div>
        ) : (
          <div style={{
            display:'flex', alignItems:'center', gap: 10,
            padding: '8px 10px',
            background: 'var(--bg-2)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}>
            <Avatar name="Rendra Admin" size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Rendra Admin</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>operator · RT-08</div>
            </div>
            <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Logout">
              <Icon.Logout size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function DeviceRow({ device, active, onClick }) {
  const statusColor = {
    online: 'var(--success)', warn: 'var(--warning)',
    offline: 'var(--muted-2)', danger: 'var(--danger)',
  }[device.status];
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', width: '100%', textAlign: 'left',
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-2)',
        borderRadius: 8,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 120ms',
        fontFamily: 'inherit',
        fontSize: 13,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {active && <div style={{ position:'absolute', left: -12, top: '20%', bottom: '20%', width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }} />}
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: active ? 'var(--bg-3)' : 'var(--bg-2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        position: 'relative',
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <Icon.Server size={14} color={active ? 'var(--accent-cyan)' : 'var(--muted)'} />
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 9, height: 9, borderRadius: '50%',
          background: statusColor,
          border: '2px solid var(--bg-1)',
          boxShadow: device.status === 'online' ? `0 0 6px ${statusColor}` : 'none',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize: 13 }}>{device.slug}</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', display:'flex', gap: 4 }} className="mono">
          {device.address}
        </div>
      </div>
      {device.active > 0 && (
        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontVariantNumeric:'tabular-nums' }}>
          {device.active}
        </span>
      )}
    </button>
  );
}

function NavItem({ item, active, compact, onClick }) {
  const IconCmp = Icon[item.icon] || Icon.Home;
  return (
    <button
      onClick={onClick}
      title={compact ? item.label : ''}
      style={{
        appearance: 'none', border: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '10px' : '8px 10px',
        width: '100%', textAlign: 'left',
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-2)',
        borderRadius: 8,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 120ms, color 120ms',
        justifyContent: compact ? 'center' : 'flex-start',
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {active && !compact && (
        <div style={{ position:'absolute', left: -12, top: '22%', bottom: '22%', width: 3, background: 'var(--accent-cyan)', borderRadius: 2 }} />
      )}
      <IconCmp size={17} color={active ? 'var(--accent-cyan)' : undefined} />
      {!compact && (
        <>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.live && <span className="dot dot-live" style={{ background:'var(--success)' }} />}
          {item.badge && <span style={{ fontSize: 10.5, color: 'var(--muted)', background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 999, border:'1px solid var(--border)' }}>{item.badge}</span>}
        </>
      )}
    </button>
  );
}

// ── Topbar ──────────────────────────────────────────────────────────────────
function Topbar({ device, theme, onTheme, onToggleSidebar }) {
  const dev = DEVICES.find(d => d.id === device);
  return (
    <header className="tb">
      <button className="btn btn-ghost btn-icon" onClick={onToggleSidebar} title="Toggle sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Icon.Server size={16} color="var(--muted)" />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Device</span>
          <Icon.Chevron size={12} color="var(--muted-2)" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{dev?.slug}</span>
          <StatusDot status={dev?.status} />
        </div>
        <div className="divider-v" style={{ height: 22, margin: '0 2px' }} />
        <PingIndicator baseMs={dev?.status === 'warn' ? 65 : dev?.status === 'offline' ? 999 : 12} />
      </div>

      <div style={{ flex: 1, display:'flex', justifyContent:'center' }}>
        <SearchInput value="" onChange={()=>{}} placeholder={`Cari user, voucher, IP, MAC, profile…`} />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
        <button className="btn btn-ghost btn-icon" title="Refresh">
          <Icon.Refresh size={16} />
        </button>
        <button className="btn btn-ghost btn-icon" title="Notifikasi" style={{ position:'relative' }}>
          <Icon.Bell size={16} />
          <span style={{ position:'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 0 2px var(--bg)' }} />
        </button>
        <button className="btn btn-ghost btn-icon" title="Tema" onClick={()=>onTheme(theme==='dark'?'light':'dark')}>
          {theme === 'dark' ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
        </button>
        <div className="divider-v" style={{ height: 24, margin: '0 4px' }} />
        <button className="btn btn-primary btn-sm">
          <Icon.Plus size={14} />
          Voucher Baru
        </button>
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar, BrandMark });
