// ui.jsx — shared design primitives, icons, mock data helpers.
// Exposed on window for cross-file use.

// ── Icons ────────────────────────────────────────────────────────────────────
// Stroke icons, 18px default, inherit currentColor.
const _Icon = (path, viewBox = "0 0 24 24") => ({ size = 18, color, style, className, strokeWidth = 1.75, fill = "none" }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill={fill} stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ color, flexShrink: 0, ...style }}
    className={className}
  >
    {path}
  </svg>
);

const Icon = {
  Home: _Icon(<><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-5h4v5"/></>),
  Users: _Icon(<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19c.5-3 3.2-5 6.5-5s6 2 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.6 0 5 1.5 5.5 4"/></>),
  Ticket: _Icon(<><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M9 5v14" strokeDasharray="2 2"/></>),
  Wifi: _Icon(<><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8 15.5a6 6 0 0 1 8 0"/><path d="M11 18.5a1.5 1.5 0 0 1 2 0"/><path d="M2 9.5a14.5 14.5 0 0 1 20 0"/></>),
  Activity: _Icon(<path d="M3 12h4l3-9 4 18 3-9h4"/>),
  Network: _Icon(<><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="9" y="15" width="6" height="6" rx="1.2"/><path d="M6 9v3a2 2 0 0 0 2 2h2"/><path d="M18 9v3a2 2 0 0 1-2 2h-2"/><path d="M12 12v3"/></>),
  Link2: _Icon(<><path d="M9 7h-2a5 5 0 0 0 0 10h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></>),
  Report: _Icon(<><path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M16 3v4h4"/><path d="M8 13l2.5 2.5L15 11"/></>),
  Cog: _Icon(<><circle cx="12" cy="12" r="3"/><path d="m19.4 15-1.4-1a7.6 7.6 0 0 0 0-4l1.4-1a1 1 0 0 0 .3-1.3l-1.6-2.8a1 1 0 0 0-1.2-.4l-1.6.6a7.6 7.6 0 0 0-3.5-2L11.5 1.4a1 1 0 0 0-1-.7H7.6a1 1 0 0 0-1 .7L6.2 3a7.6 7.6 0 0 0-3.5 2l-1.6-.6a1 1 0 0 0-1.2.4L-1.7 7.7a1 1 0 0 0 .3 1.3" transform="translate(2.5 2.5)"/></>),
  Search: _Icon(<><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></>),
  Plus: _Icon(<><path d="M12 5v14"/><path d="M5 12h14"/></>),
  Filter: _Icon(<path d="M3 5h18l-7 8v7l-4-2v-5L3 5Z"/>),
  Download: _Icon(<><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>),
  Trash: _Icon(<><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></>),
  Edit: _Icon(<><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>),
  More: _Icon(<><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></>),
  Power: _Icon(<><path d="M12 3v10"/><path d="M7.5 6.5a8 8 0 1 0 9 0"/></>),
  Chevron: _Icon(<path d="m9 6 6 6-6 6"/>),
  ChevronDown: _Icon(<path d="m6 9 6 6 6-6"/>),
  ChevronLeft: _Icon(<path d="m15 6-6 6 6 6"/>),
  X: _Icon(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>),
  Check: _Icon(<path d="m4 12 5 5L20 6"/>),
  Bell: _Icon(<><path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>),
  Sun: _Icon(<><circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M4.2 4.2l1.4 1.4"/><path d="M18.4 18.4l1.4 1.4"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M4.2 19.8l1.4-1.4"/><path d="M18.4 5.6l1.4-1.4"/></>),
  Moon: _Icon(<path d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>),
  Copy: _Icon(<><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3"/></>),
  Print: _Icon(<><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="9" rx="1.5"/><path d="M7 14h10v6H7z"/></>),
  Refresh: _Icon(<><path d="M21 11A9 9 0 0 0 6 5.5L3 8"/><path d="M3 4v4h4"/><path d="M3 13a9 9 0 0 0 15 5.5L21 16"/><path d="M21 20v-4h-4"/></>),
  Globe: _Icon(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></>),
  Server: _Icon(<><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r=".5" fill="currentColor"/><circle cx="7" cy="16.5" r=".5" fill="currentColor"/></>),
  Boot: _Icon(<><path d="M12 2v8"/><path d="M5 10h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z"/></>),
  Zap: _Icon(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>),
  Clock: _Icon(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  Eye: _Icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>),
  EyeOff: _Icon(<><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16.5 16.5 0 0 1-3 4"/><path d="M6.5 7.5C3.4 9.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.8"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/></>),
  Calendar: _Icon(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/></>),
  Logout: _Icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>),
  Mac: _Icon(<><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M11 14h.01M15 14h.01"/></>),
  Up: _Icon(<path d="m6 15 6-6 6 6"/>),
  Down: _Icon(<path d="m6 9 6 6 6-6"/>),
  ArrowUpRight: _Icon(<><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>),
  Sparkles: _Icon(<><path d="M9 3v4M7 5h4M17 11v4M15 13h4M12 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/></>),
  Kick: _Icon(<><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></>),
  Lock: _Icon(<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
};

// ── Format helpers ──────────────────────────────────────────────────────────
const fmt = {
  bytes(n) {
    if (n == null) return '—';
    const u = ['B','KB','MB','GB','TB'];
    let i = 0;
    while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 2 : i > 0 ? 1 : 0)} ${u[i]}`;
  },
  rate(bps) {
    if (bps == null) return '—';
    const u = ['bps','Kbps','Mbps','Gbps'];
    let i = 0; let n = bps;
    while (n >= 1000 && i < u.length-1) { n /= 1000; i++; }
    return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
  },
  duration(sec) {
    if (sec == null) return '—';
    const s = Math.floor(sec);
    const d = Math.floor(s/86400);
    const h = Math.floor((s%86400)/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  },
  rp(n) {
    if (n == null) return '—';
    return 'Rp ' + n.toLocaleString('id-ID');
  },
  rpShort(n) {
    if (n == null) return '—';
    if (n >= 1e9) return `Rp ${(n/1e9).toFixed(1)}M`;
    if (n >= 1e6) return `Rp ${(n/1e6).toFixed(1)}jt`;
    if (n >= 1e3) return `Rp ${(n/1e3).toFixed(0)}rb`;
    return `Rp ${n}`;
  },
  ago(secAgo) {
    if (secAgo < 5) return 'baru saja';
    if (secAgo < 60) return `${Math.floor(secAgo)}d`;
    if (secAgo < 3600) return `${Math.floor(secAgo/60)} mnt`;
    if (secAgo < 86400) return `${Math.floor(secAgo/3600)} jam`;
    return `${Math.floor(secAgo/86400)} hari`;
  },
  pct(n) { return `${Math.round(n)}%`; },
};

// ── Primitives ──────────────────────────────────────────────────────────────

function Card({ children, style, className = '', tight, accent }) {
  const borderTop = accent ? { borderTop: `2px solid ${accent}` } : null;
  return (
    <div className={`card ${tight ? 'card-tight' : ''} ${className}`} style={{ ...borderTop, ...style }}>
      {children}
    </div>
  );
}

function Badge({ tone = 'neutral', children, dot }) {
  const cls = {
    success: 'badge-success', cyan: 'badge-cyan', violet: 'badge-violet',
    lime: 'badge-lime', warn: 'badge-warn', danger: 'badge-danger',
    neutral: '',
  }[tone] || '';
  return <span className={`badge ${cls}`}>{dot && <span className="dot" style={{ width: 6, height: 6, background: 'currentColor' }} />}{children}</span>;
}

function Avatar({ name, size = 28, hue }) {
  const initials = (name || '?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const h = hue ?? (Array.from(name||'').reduce((a,c)=>a+c.charCodeAt(0),0) % 360);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h+40)%360} 70% 45%))`,
        color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size*0.38, fontWeight: 600, letterSpacing: '-0.02em', flexShrink: 0,
      }}
    >{initials}</div>
  );
}

function StatusDot({ status }) {
  const map = {
    online: { color: 'var(--success)', label: 'Online' },
    offline: { color: 'var(--muted-2)', label: 'Offline' },
    warn: { color: 'var(--warning)', label: 'Warning' },
    danger: { color: 'var(--danger)', label: 'Down' },
  };
  const m = map[status] || map.online;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: status==='online' ? `0 0 8px ${m.color}` : 'none' }} />
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{m.label}</span>
    </span>
  );
}

// Segmented control
function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} className={value===v ? 'on' : ''} onClick={()=>onChange(v)}>{label}</button>
        );
      })}
    </div>
  );
}

// ── Sparkline / Area chart ──────────────────────────────────────────────────

function Spark({ data, width = 90, height = 26, color = 'var(--accent-cyan)', kind = 'line' }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 2) - 1,
  ]);

  if (kind === 'bar') {
    const bw = width / data.length;
    return (
      <svg className="spark" width={width} height={height}>
        {data.map((v, i) => {
          const h = ((v - min) / range) * (height - 2) + 1;
          return <rect key={i} x={i*bw + 1} y={height - h} width={bw - 2} height={h} rx={1} fill={color} opacity={0.85} />;
        })}
      </svg>
    );
  }

  const pathLine = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const pathArea = pathLine + ` L${width},${height} L0,${height} Z`;

  return (
    <svg className="spark" width={width} height={height}>
      {kind === 'area' && <path d={pathArea} fill={color} opacity={0.18} />}
      <path d={pathLine} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Area/line/bar series chart (responsive svg)
function Chart({ series, width = 600, height = 200, kind = 'area', yTicks = 4, xLabels, padding = { l: 36, r: 12, t: 14, b: 22 }, formatY }) {
  const pad = padding;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const colors = ['var(--accent-cyan)', 'var(--accent-violet)', 'var(--accent-lime)'];

  const allVals = series.flatMap(s => s.data);
  const min = 0;
  const max = Math.max(1, ...allVals);
  const yScale = v => pad.t + innerH - (v / max) * innerH;
  const xCount = series[0]?.data.length || 1;
  const xScale = i => pad.l + (xCount === 1 ? innerW/2 : (i / (xCount-1)) * innerW);

  const ticks = Array.from({length: yTicks+1}, (_,i) => max * (i / yTicks));

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="g-cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5"/><stop offset="100%" stopColor="#22D3EE" stopOpacity="0"/></linearGradient>
        <linearGradient id="g-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient>
        <linearGradient id="g-lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A3E635" stopOpacity="0.5"/><stop offset="100%" stopColor="#A3E635" stopOpacity="0"/></linearGradient>
      </defs>
      {/* y grid + labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={width-pad.r} y1={yScale(t)} y2={yScale(t)} stroke="var(--border)" strokeDasharray={i===0 ? '' : '2 3'} />
          <text x={pad.l - 8} y={yScale(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted-2)" fontFamily="var(--font-mono)">
            {formatY ? formatY(t) : Math.round(t)}
          </text>
        </g>
      ))}
      {/* x labels */}
      {xLabels && xLabels.map((lab, i) => (
        <text key={i} x={xScale(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted-2)">{lab}</text>
      ))}
      {series.map((s, sIdx) => {
        const color = s.color || colors[sIdx % colors.length];
        const gradId = sIdx === 0 ? 'g-cyan' : sIdx === 1 ? 'g-violet' : 'g-lime';
        if (kind === 'bar') {
          const groupW = innerW / xCount * 0.7;
          const barW = groupW / series.length;
          return (
            <g key={sIdx}>
              {s.data.map((v, i) => (
                <rect
                  key={i}
                  x={xScale(i) - groupW/2 + sIdx*barW}
                  y={yScale(v)}
                  width={barW - 2}
                  height={Math.max(0, pad.t + innerH - yScale(v))}
                  rx={2}
                  fill={color}
                  opacity={0.85}
                />
              ))}
            </g>
          );
        }
        const pathLine = s.data.map((v, i) => (i === 0 ? 'M' : 'L') + xScale(i) + ',' + yScale(v)).join(' ');
        const pathArea = pathLine + ` L${xScale(s.data.length-1)},${pad.t + innerH} L${xScale(0)},${pad.t + innerH} Z`;
        return (
          <g key={sIdx}>
            {kind === 'area' && <path d={pathArea} fill={`url(#${gradId})`} />}
            <path d={pathLine} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={xScale(i)} cy={yScale(v)} r={2.5} fill="var(--bg-1)" stroke={color} strokeWidth={1.5} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut/ring ──────────────────────────────────────────────────────────────
function Ring({ value, size = 80, stroke = 8, color = 'var(--accent-cyan)', label, subLabel, max = 100 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(value, max) / max) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, display:'inline-block' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div style={{ position:'absolute', inset: 0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontWeight: 600, fontSize: size*0.22, fontVariantNumeric: 'tabular-nums', letterSpacing:'-0.02em' }}>{label}</div>
        {subLabel && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{subLabel}</div>}
      </div>
    </div>
  );
}

// ── Search input with hotkey hint ───────────────────────────────────────────
function SearchInput({ value, onChange, placeholder = 'Cari...', width }) {
  return (
    <div style={{ position: 'relative', flex: width ? 'none' : 1, width: width || undefined, maxWidth: 360 }}>
      <span style={{ position:'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display:'flex' }}>
        <Icon.Search size={15} />
      </span>
      <input
        className="input"
        style={{ paddingLeft: 34, paddingRight: 56 }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <span className="kbd" style={{ position:'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>⌘K</span>
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <div>
        <h1 className="ph-title">{title}</h1>
        {subtitle && <div className="ph-sub">{subtitle}</div>}
      </div>
      {right && <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap: 'wrap' }}>{right}</div>}
    </div>
  );
}

// Tiny status pill for connection state
function LiveTag({ on = true, label = 'LIVE' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems:'center', gap: 6,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
      padding: '3px 8px',
      background: on ? 'rgba(16,185,129,0.12)' : 'var(--bg-2)',
      color: on ? 'var(--success)' : 'var(--muted)',
      border: `1px solid ${on ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
      borderRadius: 999,
    }}>
      <span className={on ? 'dot dot-live' : 'dot'} style={{ background: on ? 'var(--success)' : 'var(--muted)' }} />
      {label}
    </span>
  );
}

// Tooltip (simple title-based)

// Shared form field
function Field({ label, hint, required, children, style }) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
          {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
        {hint && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, perPage, onChange, label = 'baris' }) {
  if (totalPages <= 0) totalPages = 1;
  // Window pages: show up to 5, centered on current
  const range = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) range.push(i);
  } else {
    range.push(1);
    if (page > 3) range.push('…');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) range.push(i);
    if (page < totalPages - 2) range.push('…');
    range.push(totalPages);
  }
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', gap: 8, flexWrap: 'wrap' }}>
      <span>Menampilkan <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{from}–{to}</b> dari <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{total.toLocaleString('id-ID')}</b> {label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))} style={{ opacity: page <= 1 ? 0.4 : 1, minWidth: 28, padding: 0, justifyContent: 'center' }} title="Sebelumnya">
          <Icon.ChevronLeft size={14} />
        </button>
        {range.map((p, i) =>
          p === '…'
            ? <span key={'e'+i} style={{ padding: '0 4px', color: 'var(--muted-2)' }}>…</span>
            : (
              <button key={p} onClick={() => onChange(p)}
                style={{
                  appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  minWidth: 28, height: 28, padding: '0 8px',
                  borderRadius: 7,
                  border: p === page ? '1px solid transparent' : '1px solid var(--border)',
                  background: p === page ? 'var(--accent-cyan-soft)' : 'transparent',
                  color: p === page ? 'var(--accent-cyan)' : 'var(--text-2)',
                  fontSize: 12, fontWeight: p === page ? 600 : 500,
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'background 120ms',
                }}>
                {p}
              </button>
            )
        )}
        <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))} style={{ opacity: page >= totalPages ? 0.4 : 1, minWidth: 28, padding: 0, justifyContent: 'center' }} title="Berikutnya">
          <Icon.Chevron size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Ping indicator ──────────────────────────────────────────────────────────
function PingIndicator({ baseMs = 12 }) {
  const [ping, setPing] = React.useState(baseMs);
  const [history, setHistory] = React.useState(() => Array.from({ length: 12 }, () => baseMs + Math.random() * 8));
  React.useEffect(() => {
    const t = setInterval(() => {
      // Random walk around baseMs with occasional spikes
      setPing(prev => {
        const spike = Math.random() < 0.05;
        const next = spike ? baseMs + 40 + Math.random() * 60 : Math.max(2, baseMs + (Math.random() - 0.5) * 8);
        setHistory(h => [...h.slice(1), next]);
        return Math.round(next);
      });
    }, 1400);
    return () => clearInterval(t);
  }, [baseMs]);

  const status = ping < 30 ? 'good' : ping < 80 ? 'ok' : 'bad';
  const color = status === 'good' ? 'var(--success)' : status === 'ok' ? 'var(--warning)' : 'var(--danger)';
  const label = status === 'good' ? 'Stabil' : status === 'ok' ? 'Lambat' : 'Tinggi';
  return (
    <div title={`Round-trip ke router · ${label}`} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 10px 4px 8px',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 999,
      height: 30,
    }}>
      <span className="dot dot-live" style={{ background: color }} />
      <Spark data={history} color={color} kind="line" width={36} height={14} />
      <span className="mono tabular" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 32, textAlign: 'right' }}>
        {ping}<span style={{ color: 'var(--muted)', marginLeft: 2, fontSize: 10, fontWeight: 500 }}>ms</span>
      </span>
    </div>
  );
}

Object.assign(window, {
  Icon, fmt, Card, Badge, Avatar, StatusDot, Segmented,
  Spark, Chart, Ring, SearchInput, PageHeader, LiveTag, Field,
  Pagination, PingIndicator,
});
