// system.jsx — System screen (identity, resource, routerboard, scripts, schedulers, log)

function SystemScreen({ device }) {
  const [tab, setTab] = React.useState('overview');
  const dev = DEVICES.find(d => d.id === device) || DEVICES[0];

  return (
    <div className="fade-in">
      <PageHeader
        title="System"
        subtitle={<>Identity, resource, scripts, scheduler & logs · <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{device}</b></>}
        right={(
          <>
            <button className="btn btn-sm"><Icon.Download size={13} />Backup</button>
            <button className="btn btn-sm btn-danger"><Icon.Refresh size={13} />Reboot</button>
          </>
        )}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        <SysTab id="overview"   active={tab==='overview'}   onClick={()=>setTab('overview')}   label="Overview"   icon="Server" />
        <SysTab id="scripts"    active={tab==='scripts'}    onClick={()=>setTab('scripts')}    label="Scripts"    icon="Edit"   count={SCRIPTS.length} />
        <SysTab id="schedulers" active={tab==='schedulers'} onClick={()=>setTab('schedulers')} label="Schedulers" icon="Clock"  count={SCHEDULERS.length} />
        <SysTab id="logs"       active={tab==='logs'}       onClick={()=>setTab('logs')}       label="Logs"       icon="Activity" count={LOGS.length} live />
      </div>

      {tab === 'overview'   && <SysOverview dev={dev} />}
      {tab === 'scripts'    && <SysScripts />}
      {tab === 'schedulers' && <SysSchedulers />}
      {tab === 'logs'       && <SysLogs />}
    </div>
  );
}

function SysTab({ active, onClick, label, count, icon, live }) {
  const IconCmp = Icon[icon] || Icon.Server;
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 0, background: 'transparent',
        padding: '12px 16px', color: active ? 'var(--text)' : 'var(--muted)',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
        marginBottom: -1,
      }}
    >
      <IconCmp size={15} color={active ? 'var(--accent-cyan)' : undefined} />
      {label}
      {count != null && (
        <span style={{ fontSize: 11, color: active ? 'var(--accent-cyan)' : 'var(--muted)', padding: '1px 7px', borderRadius: 999, background: active ? 'var(--accent-cyan-soft)' : 'var(--bg-2)', border: '1px solid var(--border)' }}>{count}</span>
      )}
      {live && <span className="dot dot-live" style={{ background: 'var(--success)' }} />}
      {active && <div style={{ position: 'absolute', left: 12, right: 12, bottom: -1, height: 2, background: 'var(--accent-cyan)', borderRadius: 2 }} />}
    </button>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────────
function SysOverview({ dev }) {
  return (
    <>
      {/* Top row: Identity + Resource + Routerboard + Clock */}
      <div className="grid-2-fixed">
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 14 }}>Identity & Hardware</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div style={{
              width: 68, height: 68, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent-cyan-soft), var(--accent-violet-soft))',
              border: '1px solid var(--border-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <Icon.Server size={30} color="var(--accent-cyan)" />
              <span className="dot-live" style={{ position: 'absolute', bottom: 4, right: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-1)' }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{dev.slug}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{dev.name}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-cyan)', marginTop: 4 }} className="mono">{dev.version}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KV2 label="Board" value="hAP ac²" />
            <KV2 label="Architecture" value="arm" />
            <KV2 label="Serial" value="HEX8-9KL2-MNO4" />
            <KV2 label="Firmware Type" value="routerboard" />
            <KV2 label="IP / Mgmt" value={dev.address} />
            <KV2 label="Uptime" value={dev.uptime} />
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Resource (Live)</span>
            <LiveTag label="1s" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <ResRing label="CPU" value={37} color="var(--accent-cyan)" detail="MIPSBE 880MHz · load 0.42" />
            <ResRing label="RAM" value={62} color="var(--accent-violet)" detail="159 / 256 MB" />
            <ResRing label="Disk" value={18} color="var(--accent-lime)" detail="14 / 80 MB" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <KV2 label="CPU Temp" value="48 °C" mono accent="cyan" />
            <KV2 label="Voltage" value="24.1 V" mono />
            <KV2 label="Power Consumption" value="3.2 W" mono />
            <KV2 label="Firmware" value="7.16.2 stable" mono />
          </div>
        </Card>
      </div>

      {/* Clock + Logging row */}
      <div className="grid-3" style={{ marginTop: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 10 }}>Clock</div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }} className="mono tabular">
            {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="divider" />
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>Timezone</span><span className="mono">Asia/Jakarta · UTC+07</span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: 'var(--muted)' }}>NTP</span><Badge tone="success" dot>synced</Badge>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 10 }}>Logging Config</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LogPrefix prefix="hotspot,info" target="memory" enabled={true} />
            <LogPrefix prefix="hotspot,account" target="disk" enabled={true} />
            <LogPrefix prefix="system,error" target="memory" enabled={true} />
            <LogPrefix prefix="firewall,warning" target="memory" enabled={false} />
          </div>
          <button className="btn btn-sm" style={{ marginTop: 12, width: '100%' }}><Icon.Plus size={12}/>Tambah rule logging</button>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 10 }}>Aksi Berbahaya</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DangerAction icon="Refresh" title="Reboot Router" desc="Restart sistem · ~60 detik downtime" />
            <DangerAction icon="Power" title="Shutdown" desc="Matikan total · butuh akses fisik" critical />
            <DangerAction icon="Download" title="Backup config" desc="Simpan ke /file/backup-{date}.backup" />
          </div>
        </Card>
      </div>
    </>
  );
}

function ResRing({ label, value, color, detail }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', background: 'var(--bg-2)', borderRadius: 10 }}>
      <Ring value={value} size={72} stroke={7} color={color} label={`${value}%`} />
      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textAlign: 'center' }} className="mono">{detail}</div>
    </div>
  );
}

function KV2({ label, value, mono, accent }) {
  const c = accent === 'cyan' ? 'var(--accent-cyan)' : accent === 'violet' ? 'var(--accent-violet)' : 'var(--text-2)';
  return (
    <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 7 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: c }}>{value}</div>
    </div>
  );
}

function LogPrefix({ prefix, target, enabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
      <span className={enabled ? 'dot dot-live' : 'dot'} style={{ background: enabled ? 'var(--success)' : 'var(--muted-2)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{prefix}</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>→ {target}</div>
      </div>
      <div className="switch" data-on={enabled} style={{ pointerEvents: 'none' }} />
    </div>
  );
}

function DangerAction({ icon, title, desc, critical }) {
  const IconCmp = Icon[icon] || Icon.Refresh;
  const color = critical ? 'var(--danger)' : 'var(--warning)';
  const bg = critical ? 'rgba(244,63,94,0.10)' : 'rgba(245,158,11,0.10)';
  return (
    <button style={{
      appearance: 'none', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 9,
      border: `1px solid ${critical ? 'rgba(244,63,94,0.25)' : 'var(--border-strong)'}`,
      background: bg, color: 'inherit', cursor: 'pointer',
      fontFamily: 'inherit', textAlign: 'left', width: '100%',
      transition: 'all 140ms',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, flexShrink: 0 }}>
        <IconCmp size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</div>
      </div>
      <Icon.Chevron size={14} color="var(--muted)" />
    </button>
  );
}

// ── Scripts ─────────────────────────────────────────────────────────────────
function SysScripts() {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(SCRIPTS.length / perPage) || 1;
  const data = SCRIPTS.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Scripts ({SCRIPTS.length})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SearchInput value="" onChange={()=>{}} placeholder="Cari script..." width={200} />
          <button className="btn btn-primary btn-sm"><Icon.Plus size={13} />New Script</button>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Policy</th><th>Last Run</th><th>Total Runs</th><th>Source preview</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
        <tbody>
          {data.map(s => (
            <tr key={s.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-cyan-soft)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon.Edit size={13} />
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.policy.split(',').map(p => <Badge key={p} tone="cyan">{p}</Badge>)}
                </div>
              </td>
              <td className="mono" style={{ fontSize: 12 }}>{fmt.ago((Date.now() - s.lastStarted)/1000)} lalu</td>
              <td className="mono tabular">{s.runCount.toLocaleString('id-ID')}</td>
              <td>
                <code style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>{s.source}</code>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Run"><Icon.Zap size={13} color="var(--accent-lime)" /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Edit size={13} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Trash size={13} color="var(--danger)" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={SCRIPTS.length} perPage={perPage} onChange={setPage} label="script" />
    </Card>
  );
}

// ── Schedulers ──────────────────────────────────────────────────────────────
function SysSchedulers() {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(SCHEDULERS.length / perPage) || 1;
  const data = SCHEDULERS.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Schedulers ({SCHEDULERS.length})</div>
        <button className="btn btn-primary btn-sm"><Icon.Plus size={13} />New Scheduler</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Name</th><th>Interval</th><th>On Event</th><th>Next Run</th><th>Run Count</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
        <tbody>
          {data.map(s => (
            <tr key={s.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon.Clock size={13} />
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }} className="mono">started {s.startDate} {s.startTime}</div>
                  </div>
                </div>
              </td>
              <td><Badge tone="cyan">every {s.interval}</Badge></td>
              <td><code style={{ fontSize: 12, color: 'var(--accent-cyan)' }} className="mono">{s.onEvent}</code></td>
              <td className="mono" style={{ fontSize: 12 }}>{s.disabled ? '—' : new Date(s.nextRun).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (in ' + fmt.duration(Math.max(0, (s.nextRun - Date.now())/1000)) + ')'}</td>
              <td className="mono tabular">{s.runCount.toLocaleString('id-ID')}</td>
              <td>{s.disabled ? <Badge tone="neutral">Disabled</Badge> : <Badge tone="success" dot>Active</Badge>}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Power size={13} color={s.disabled ? 'var(--muted)' : 'var(--success)'} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Edit size={13} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Trash size={13} color="var(--danger)" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={SCHEDULERS.length} perPage={perPage} onChange={setPage} label="scheduler" />
    </Card>
  );
}

// ── Logs ────────────────────────────────────────────────────────────────────
function SysLogs() {
  const [filter, setFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const perPage = 20;
  const all = LOGS.filter(l => filter === 'all' || l.topics.includes(filter));
  const totalPages = Math.ceil(all.length / perPage) || 1;
  const filtered = all.slice((page-1)*perPage, page*perPage);
  React.useEffect(() => { setPage(1); }, [filter]);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveTag label="STREAMING" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>System Log</div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">/stream/log</span>
        </div>
        <Segmented value={filter} onChange={setFilter} options={[{value:'all',label:'Semua'},{value:'hotspot',label:'Hotspot'},{value:'system',label:'System'},{value:'firewall',label:'Firewall'}]} />
      </div>
      <div style={{ maxHeight: 600, overflow: 'auto', padding: 0, background: 'var(--bg)' }}>
        {filtered.map((l, i) => {
          const isWarn = l.topics.includes('warning');
          const isError = l.topics.includes('error');
          const color = isError ? 'var(--danger)' : isWarn ? 'var(--warning)' : 'var(--accent-cyan)';
          return (
            <div key={l.id} className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <span style={{ color: 'var(--muted-2)', minWidth: 64 }}>{l.time}</span>
              <span style={{ color, minWidth: 160, fontSize: 11 }}>{l.topics}</span>
              <span style={{ flex: 1, color: 'var(--text-2)' }}>{l.message}</span>
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={all.length} perPage={perPage} onChange={setPage} label="log line" />
    </Card>
  );
}

window.SystemScreen = SystemScreen;
