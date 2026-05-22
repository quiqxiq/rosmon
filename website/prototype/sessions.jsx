// sessions.jsx — Live Sessions screen (SSE-style real-time view).

function SessionsScreen({ device, chartKind }) {
  const [sessions, setSessions] = React.useState(HS_ACTIVE);
  const [selected, setSelected] = React.useState(null);
  const [events, setEvents] = React.useState(() => [
    { id: 1, type: 'connected', t: Date.now() - 1000, msg: 'EventSource opened · subscriber #1' },
    { id: 2, type: 'login', t: Date.now() - 800, user: HS_ACTIVE[0].user, ip: HS_ACTIVE[0].address },
  ]);
  const [paused, setPaused] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [stats, setStats] = React.useState({
    peak: 187, joined: 12, kicked: 1, totalRx: 4.2e9, totalTx: 0.9e9,
  });
  const tickRef = React.useRef(0);
  const idRef = React.useRef(100);

  // Tick: update bytes/rates + sparkline
  React.useEffect(() => {
    const t = setInterval(() => {
      if (paused) return;
      tickRef.current++;
      setSessions(prev => prev.map(s => ({
        ...s,
        bytesIn: s.bytesIn + Math.floor(s.rxRate / 8),
        bytesOut: s.bytesOut + Math.floor(s.txRate / 8),
        rxRate: Math.max(50_000, s.rxRate + (Math.random()-0.5) * 500_000),
        txRate: Math.max(20_000, s.txRate + (Math.random()-0.5) * 200_000),
        sparkIn: [...s.sparkIn.slice(1), s.rxRate],
      })));
    }, 1200);
    return () => clearInterval(t);
  }, [paused]);

  // Occasional join/leave events
  React.useEffect(() => {
    const t = setInterval(() => {
      if (paused) return;
      const roll = Math.random();
      if (roll < 0.35) {
        // join
        const newSession = makeSession(idRef.current++);
        setSessions(prev => [newSession, ...prev].slice(0, 16));
        setEvents(e => [{ id: idRef.current++, type: 'login', t: Date.now(), user: newSession.user, ip: newSession.address }, ...e].slice(0, 50));
        setStats(s => ({ ...s, joined: s.joined + 1 }));
      } else if (roll < 0.55 && sessions.length > 8) {
        // disconnect
        setSessions(prev => {
          const idx = Math.floor(Math.random() * prev.length);
          const gone = prev[idx];
          setEvents(e => [{ id: idRef.current++, type: 'logout', t: Date.now(), user: gone.user, ip: gone.address, reason: 'idle-timeout' }, ...e].slice(0, 50));
          return prev.filter((_,i) => i !== idx);
        });
      }
    }, 4200);
    return () => clearInterval(t);
  }, [paused, sessions.length]);

  const kick = (id) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    setSessions(prev => prev.filter(x => x.id !== id));
    setEvents(e => [{ id: idRef.current++, type: 'kick', t: Date.now(), user: s.user, ip: s.address, reason: 'manual' }, ...e].slice(0, 50));
    setStats(s2 => ({ ...s2, kicked: s2.kicked + 1 }));
    if (selected === id) setSelected(null);
  };

  const filtered = sessions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'high-traffic') return s.rxRate > 2_000_000;
    if (filter === 'idle') return s.rxRate < 500_000;
    if (filter === 'mobile') return (s.mac || '').startsWith('A') || (s.mac || '').startsWith('B') || (s.mac || '').startsWith('C');
    return true;
  });

  const totalRx = sessions.reduce((a,s) => a + s.rxRate, 0);
  const totalTx = sessions.reduce((a,s) => a + s.txRate, 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Live Sessions"
        subtitle={<>Server-Sent Events stream dari <span className="mono" style={{ color: 'var(--accent-cyan)' }}>/stream/hotspot/active</span> · {device}</>}
        right={(
          <>
            <LiveTag on={!paused} label={paused ? 'PAUSED' : 'STREAM AKTIF'} />
            <button className="btn btn-sm" onClick={()=>setPaused(p=>!p)}>
              {paused ? <><Icon.Refresh size={13}/>Resume</> : <><Icon.Power size={13}/>Pause</>}
            </button>
          </>
        )}
      />

      {/* Top stats */}
      <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap-grid)' }}>
        <LiveStatCard label="Active Sessions" value={sessions.length} delta={`peak ${stats.peak} hari ini`} accent="cyan" icon="Activity" pulsing />
        <LiveStatCard label="Throughput Total" value={fmt.rate(totalRx + totalTx)} delta={`↓${fmt.rate(totalRx)} · ↑${fmt.rate(totalTx)}`} accent="violet" icon="Zap" />
        <LiveStatCard label="Login hari ini" value={stats.joined + 158} delta={`+${stats.joined} sejak monitor dibuka`} accent="lime" icon="ArrowUpRight" />
        <LiveStatCard label="Kicked / Errors" value={stats.kicked} delta="manual + idle-timeout" accent="warn" icon="Kick" />
      </div>

      {/* Main layout */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr 320px', gap: 'var(--gap-grid)', marginTop: 'var(--gap-grid)' }}>
        <div>
          {/* Live throughput chart */}
          <Card style={{ marginBottom: 'var(--gap-grid)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500 }}>Throughput Realtime</div>
                <div style={{ display:'flex', alignItems:'center', gap: 16, marginTop: 4 }}>
                  <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                    <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt.rate(totalRx)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>RX</span>
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-violet)' }} />
                    <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt.rate(totalTx)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>TX</span>
                  </span>
                </div>
              </div>
              <Segmented value="1m" onChange={()=>{}} options={['30s','1m','5m']} />
            </div>
            <LiveTrafficChart sessions={sessions} tick={tickRef.current} kind={chartKind} />
          </Card>

          {/* Sessions table */}
          <Card style={{ padding: 0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Sessions ({filtered.length})</span>
                <span className="dot dot-live" style={{ background: 'var(--success)' }} />
              </div>
              <Segmented value={filter} onChange={setFilter}
                options={[{value:'all',label:'Semua'},{value:'high-traffic',label:'High traffic'},{value:'idle',label:'Idle'},{value:'mobile',label:'Mobile'}]} />
            </div>
            <table className="tbl tbl-clickable">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Address</th>
                  <th>Uptime</th>
                  <th>Throughput</th>
                  <th>Total</th>
                  <th style={{ textAlign:'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <SessionRow key={s.id} s={s} selected={selected === s.id} onClick={()=>setSelected(selected === s.id ? null : s.id)} onKick={()=>kick(s.id)} />
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Right column: detail or event stream */}
        <div style={{ display:'flex', flexDirection:'column', gap: 'var(--gap-grid)' }}>
          {selected ? (
            <SessionDetailCard s={sessions.find(x => x.id === selected)} onClose={()=>setSelected(null)} onKick={()=>kick(selected)} />
          ) : null}
          <EventStreamCard events={events} paused={paused} onPause={()=>setPaused(p=>!p)} />
        </div>
      </div>
    </div>
  );
}

function makeSession(seed) {
  const fn = FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)].toLowerCase();
  return {
    id: `*L${seed.toString(16).toUpperCase()}`,
    user: `${fn}${100 + Math.floor(Math.random()*900)}`,
    profile: PROFILES[Math.floor(Math.random()*PROFILES.length)].name,
    server: Math.random() > 0.5 ? 'hotspot1' : 'hotspot2',
    address: ipFromSeed(Math.floor(Math.random()*120)),
    mac: macRand(),
    loginBy: 'http-chap',
    uptimeStart: Date.now() - Math.random() * 60 * 1000,
    bytesIn: 0,
    bytesOut: 0,
    rxRate: 200000 + Math.floor(Math.random() * 5_000_000),
    txRate: 50000 + Math.floor(Math.random() * 1_500_000),
    sparkIn: Array.from({length:18}, () => Math.random() * 1000000),
  };
}

function LiveStatCard({ label, value, delta, accent, icon, pulsing }) {
  const IconCmp = Icon[icon] || Icon.Activity;
  const colorMap = { cyan: 'var(--accent-cyan)', violet: 'var(--accent-violet)', lime: 'var(--accent-lime)', warn: 'var(--warning)' };
  const bgMap = { cyan: 'var(--accent-cyan-soft)', violet: 'var(--accent-violet-soft)', lime: 'var(--accent-lime-soft)', warn: 'rgba(245,158,11,0.12)' };
  const c = colorMap[accent], bg = bgMap[accent];
  return (
    <Card style={{ position:'relative', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, color: c, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <IconCmp size={16} />
          {pulsing && <span className="dot-live" style={{ position:'absolute', inset: 0, borderRadius: 8, background: 'transparent' }} />}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }} className="tabular">{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{delta}</div>
    </Card>
  );
}

function LiveTrafficChart({ sessions, tick, kind }) {
  // Aggregate spark across all sessions
  const len = 18;
  const agg = React.useMemo(() => {
    const out = Array(len).fill(0);
    sessions.forEach(s => s.sparkIn.forEach((v,i) => out[i] += v));
    return out;
  }, [sessions, tick]);
  // mock TX series as 25% of agg
  const tx = agg.map(v => v * 0.25);
  return (
    <Chart
      kind={kind}
      height={180}
      series={[
        { data: agg.map(v => v / 1_000_000), color: 'var(--accent-cyan)' },
        { data: tx.map(v => v / 1_000_000), color: 'var(--accent-violet)' },
      ]}
      xLabels={['-60s','-50s','-40s','-30s','-20s','-10s','now']}
      formatY={v => `${v.toFixed(0)}M`}
    />
  );
}

function SessionRow({ s, selected, onClick, onKick }) {
  const uptimeSec = Math.floor((Date.now() - s.uptimeStart) / 1000);
  const total = s.bytesIn + s.bytesOut;
  const isHigh = s.rxRate > 2_500_000;
  return (
    <tr onClick={onClick} style={{ background: selected ? 'var(--bg-active)' : '' }} className="fade-in">
      <td>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ position:'relative' }}>
            <Avatar name={s.user} size={28} />
            <span className="dot-live" style={{ position:'absolute', bottom:-2, right:-2, width: 9, height: 9, borderRadius:'50%', background:'var(--success)', border:'2px solid var(--bg-1)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.user}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              <Badge tone={PROFILES.find(p=>p.name===s.profile)?.color || 'neutral'}>{s.profile}</Badge>
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="mono" style={{ fontSize: 12.5 }}>{s.address}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{s.mac}</div>
      </td>
      <td>
        <span className="mono" style={{ fontSize: 12 }}>{fmt.duration(uptimeSec)}</span>
      </td>
      <td>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Spark data={s.sparkIn} color={isHigh ? 'var(--accent-lime)' : 'var(--accent-cyan)'} kind="area" width={70} height={22} />
          <div style={{ minWidth: 70 }}>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent-cyan)' }}>↓ {fmt.rate(s.rxRate)}</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent-violet)' }}>↑ {fmt.rate(s.txRate)}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="mono" style={{ fontSize: 12 }}>{fmt.bytes(total)}</div>
      </td>
      <td>
        <div style={{ display:'flex', gap: 4, justifyContent:'flex-end' }} onClick={e=>e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Lihat detail" onClick={onClick}>
            <Icon.Eye size={13} />
          </button>
          <button className="btn btn-danger btn-icon" style={{ width: 28, height: 28 }} title="Kick session" onClick={onKick}>
            <Icon.Kick size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SessionDetailCard({ s, onClose, onKick }) {
  if (!s) return null;
  const uptimeSec = Math.floor((Date.now() - s.uptimeStart) / 1000);
  return (
    <Card className="slide-in-r" style={{ position:'relative' }}>
      <button className="btn btn-ghost btn-icon" style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28 }} onClick={onClose}>
        <Icon.X size={14} />
      </button>
      <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 14 }}>
        <div style={{ position:'relative' }}>
          <Avatar name={s.user} size={42} />
          <span className="dot-live" style={{ position:'absolute', bottom:-1, right:-1, width: 11, height: 11, borderRadius:'50%', background:'var(--success)', border:'2px solid var(--bg-1)' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{s.user}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            <Badge tone={PROFILES.find(p=>p.name===s.profile)?.color || 'neutral'}>{s.profile}</Badge>
            <span style={{ marginLeft: 6 }} className="mono">{s.server}</span>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <DetailKV label="IP" value={s.address} mono />
        <DetailKV label="MAC" value={s.mac} mono />
        <DetailKV label="Uptime" value={fmt.duration(uptimeSec)} mono />
        <DetailKV label="Login" value={s.loginBy} mono />
        <DetailKV label="Bytes IN" value={fmt.bytes(s.bytesIn)} mono accent="cyan" />
        <DetailKV label="Bytes OUT" value={fmt.bytes(s.bytesOut)} mono accent="violet" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom: 4 }}>Bandwidth 60 detik terakhir</div>
        <div style={{ padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 8 }}>
          <Spark data={s.sparkIn} color="var(--accent-cyan)" kind="area" width={300} height={50} />
        </div>
      </div>

      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-sm" style={{ flex: 1 }}>
          <Icon.Eye size={13} /> Detail User
        </button>
        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={onKick}>
          <Icon.Kick size={13} /> Kick Session
        </button>
      </div>
    </Card>
  );
}

function DetailKV({ label, value, mono, accent }) {
  const c = accent === 'cyan' ? 'var(--accent-cyan)' : accent === 'violet' ? 'var(--accent-violet)' : 'var(--text)';
  return (
    <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 13, fontWeight: 500, marginTop: 2, color: c }}>{value}</div>
    </div>
  );
}

function EventStreamCard({ events, paused, onPause }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Icon.Activity size={14} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Event Stream</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }} className="mono">
          {paused ? 'paused' : 'live'} · {events.length}
        </div>
      </div>
      <div style={{ maxHeight: 460, overflow: 'auto', padding: 8 }}>
        {events.map(e => <EventItem key={e.id} e={e} />)}
        {events.length === 0 && (
          <div style={{ padding: 30, textAlign:'center', color: 'var(--muted)', fontSize: 12 }}>Belum ada event.</div>
        )}
      </div>
    </Card>
  );
}

function EventItem({ e }) {
  const map = {
    connected: { color: 'var(--muted)',         bg: 'var(--bg-2)',                icon: 'Globe',     label: 'connected'  },
    login:     { color: 'var(--accent-cyan)',   bg: 'var(--accent-cyan-soft)',    icon: 'ArrowUpRight', label: 'login'   },
    logout:    { color: 'var(--muted)',         bg: 'var(--bg-2)',                icon: 'Power',     label: 'logout'     },
    kick:      { color: 'var(--danger)',        bg: 'rgba(244,63,94,0.12)',       icon: 'Kick',      label: 'kicked'     },
  };
  const m = map[e.type] || map.login;
  const IconCmp = Icon[m.icon] || Icon.Activity;
  const secAgo = Math.max(1, Math.floor((Date.now() - e.t) / 1000));
  return (
    <div className="fade-in" style={{ display:'flex', alignItems:'center', gap: 10, padding: '6px 8px', borderRadius: 6, borderLeft: `2px solid ${m.color}`, marginBottom: 4 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: m.bg, color: m.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
        <IconCmp size={11} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          <span style={{ fontWeight: 600, color: m.color, textTransform:'uppercase', letterSpacing:'0.04em', fontSize: 10 }}>{m.label}</span>{' '}
          {e.user && <span style={{ fontWeight: 500 }} className="mono">{e.user}</span>}
          {e.msg && <span>{e.msg}</span>}
          {e.ip && <span style={{ color: 'var(--muted)' }}> · <span className="mono">{e.ip}</span></span>}
          {e.reason && <span style={{ color: 'var(--muted)' }}> · {e.reason}</span>}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--muted-2)' }} className="mono">{fmt.ago(secAgo)}</span>
    </div>
  );
}

window.SessionsScreen = SessionsScreen;
