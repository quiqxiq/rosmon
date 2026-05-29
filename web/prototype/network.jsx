// network.jsx — Network screen (interfaces, IP pools, ARP, DHCP leases, queues)

function NetworkScreen({ device, chartKind }) {
  const [tab, setTab] = React.useState('interfaces');

  return (
    <div className="fade-in">
      <PageHeader
        title="Network"
        subtitle={<>Interface, IP pool, ARP, DHCP lease, dan simple queue untuk <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{device}</b></>}
        right={<button className="btn btn-sm"><Icon.Refresh size={13} />Reload</button>}
      />

      {/* Health KPIs */}
      <div className="grid-kpi" style={{ marginBottom: 'var(--gap-grid)' }}>
        <NetKpi label="Interfaces running" value={`${INTERFACES.filter(i=>i.running).length} / ${INTERFACES.length}`} icon="Wifi" color="cyan" subtitle="2 ether · 2 wlan · 1 bridge · 1 pppoe" />
        <NetKpi label="DHCP Leases" value={DHCP_LEASES.length} icon="Globe" color="violet" subtitle={`${DHCP_LEASES.filter(l=>l.status==='bound').length} bound · ${DHCP_LEASES.filter(l=>l.status==='waiting').length} waiting`} />
        <NetKpi label="ARP Entries" value={ARP.length} icon="Network" color="lime" subtitle={`${ARP.filter(a=>a.dynamic).length} dynamic · ${ARP.filter(a=>!a.dynamic).length} static`} />
        <NetKpi label="Simple Queues" value={QUEUES.length} icon="Zap" color="cyan" subtitle={`Total cap: ${fmt.rate(QUEUES.reduce((a,q)=>a+q.maxLimitBps, 0))}`} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <NetTab id="interfaces" active={tab==='interfaces'} onClick={()=>setTab('interfaces')} label="Interfaces" count={INTERFACES.length} icon="Wifi" />
        <NetTab id="pools"      active={tab==='pools'}      onClick={()=>setTab('pools')}      label="IP Pools"  count={IP_POOLS.length}   icon="Globe" />
        <NetTab id="arp"        active={tab==='arp'}        onClick={()=>setTab('arp')}        label="ARP"       count={ARP.length}        icon="Mac" />
        <NetTab id="dhcp"       active={tab==='dhcp'}       onClick={()=>setTab('dhcp')}       label="DHCP Leases" count={DHCP_LEASES.length} icon="Clock" />
        <NetTab id="queues"     active={tab==='queues'}     onClick={()=>setTab('queues')}     label="Queues"    count={QUEUES.length}     icon="Zap" />
      </div>

      {tab === 'interfaces' && <InterfacesTable chartKind={chartKind} />}
      {tab === 'pools'      && <IPPoolsGrid />}
      {tab === 'arp'        && <ARPTable />}
      {tab === 'dhcp'       && <DHCPLeasesTable />}
      {tab === 'queues'     && <QueuesTable />}
    </div>
  );
}

function NetKpi({ label, value, icon, color, subtitle }) {
  const IconCmp = Icon[icon] || Icon.Wifi;
  const colorMap = { cyan: 'var(--accent-cyan)', violet: 'var(--accent-violet)', lime: 'var(--accent-lime)' };
  const bgMap = { cyan: 'var(--accent-cyan-soft)', violet: 'var(--accent-violet-soft)', lime: 'var(--accent-lime-soft)' };
  const c = colorMap[color], bg = bgMap[color];
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCmp size={16} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{subtitle}</div>
    </Card>
  );
}

function NetTab({ active, onClick, label, count, icon }) {
  const IconCmp = Icon[icon] || Icon.Wifi;
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 0, background: 'transparent',
        padding: '12px 14px', color: active ? 'var(--text)' : 'var(--muted)',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
        marginBottom: -1,
      }}
    >
      <IconCmp size={14} color={active ? 'var(--accent-cyan)' : undefined} />
      {label}
      <span style={{ fontSize: 11, color: active ? 'var(--accent-cyan)' : 'var(--muted)', padding: '1px 6px', borderRadius: 999, background: active ? 'var(--accent-cyan-soft)' : 'var(--bg-2)', border: '1px solid var(--border)' }}>{count}</span>
      {active && <div style={{ position: 'absolute', left: 10, right: 10, bottom: -1, height: 2, background: 'var(--accent-cyan)', borderRadius: 2 }} />}
    </button>
  );
}

// ── Interfaces ──────────────────────────────────────────────────────────────
function InterfacesTable({ chartKind }) {
  const [page, setPage] = React.useState(1);
  const perPage = 6;
  const totalPages = Math.ceil(INTERFACES.length / perPage) || 1;
  const data = INTERFACES.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Interface</th>
            <th>Type</th>
            <th>Link</th>
            <th>MAC</th>
            <th>Throughput</th>
            <th>Total Traffic</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.map(i => {
            const typeColor = i.type === 'ether' ? 'cyan' : i.type === 'wlan' ? 'violet' : i.type === 'bridge' ? 'lime' : 'neutral';
            const totalThru = i.rxRate + i.txRate;
            return (
              <tr key={i.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: i.running ? 'var(--accent-cyan-soft)' : 'var(--bg-2)', color: i.running ? 'var(--accent-cyan)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Icon.Wifi size={14} />
                      {i.running && <span className="dot dot-live" style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-1)' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }} className="mono">{i.name}</div>
                      {i.comment && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{i.comment}</div>}
                    </div>
                  </div>
                </td>
                <td><Badge tone={typeColor}>{i.type}</Badge></td>
                <td className="mono" style={{ fontSize: 12, color: i.running ? 'var(--text-2)' : 'var(--muted)' }}>{i.link}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{i.macAddress}</td>
                <td>
                  {totalThru > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Spark
                        data={Array.from({length: 16}, (_,j) => totalThru * (0.6 + Math.sin(j/2) * 0.4))}
                        color={i.running ? 'var(--accent-cyan)' : 'var(--muted)'} kind="area"
                        width={70} height={22}
                      />
                      <div style={{ minWidth: 90 }}>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent-cyan)' }}>↓ {fmt.rate(i.rxRate)}</div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent-violet)' }}>↑ {fmt.rate(i.txRate)}</div>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td>
                  <div className="mono" style={{ fontSize: 11.5 }}>{fmt.bytes(i.rxBytes + i.txBytes)}</div>
                </td>
                <td>
                  {i.disabled ? <Badge tone="neutral">Disabled</Badge>
                    : i.running ? <Badge tone="success" dot>Running</Badge>
                    : <Badge tone="warn">No link</Badge>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Activity size={13} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Edit size={13} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.More size={13} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={INTERFACES.length} perPage={perPage} onChange={setPage} label="interface" />
    </Card>
  );
}

// ── IP Pools ────────────────────────────────────────────────────────────────
function IPPoolsGrid() {
  return (
    <div className="grid-3">
      {IP_POOLS.map(p => {
        const pct = (p.used / p.total) * 100;
        const color = pct > 80 ? 'var(--warning)' : pct > 95 ? 'var(--danger)' : 'var(--accent-cyan)';
        return (
          <Card key={p.id} accent={color}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-cyan-soft)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon.Globe size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }} className="mono">{p.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }} className="mono">{p.ranges}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }}><Icon.More size={13} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Usage</span>
              <span className="mono" style={{ fontSize: 12 }}>
                <b style={{ color: color, fontWeight: 600 }}>{p.used}</b>
                <span style={{ color: 'var(--muted)' }}> / {p.total} IP</span>
              </span>
            </div>
            <div className="bar"><i style={{ width: pct + '%', background: color }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              <span>{pct.toFixed(1)}% terpakai</span>
              <span>{p.total - p.used} IP tersedia</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── ARP table ───────────────────────────────────────────────────────────────
function ARPTable() {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(ARP.length / perPage) || 1;
  const data = ARP.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <table className="tbl">
        <thead>
          <tr><th>IP Address</th><th>MAC Address</th><th>Interface</th><th>Type</th><th>Complete</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
        </thead>
        <tbody>
          {data.map(a => (
            <tr key={a.id}>
              <td className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{a.address}</td>
              <td className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.macAddress}</td>
              <td><Badge tone={a.interface.startsWith('wlan') ? 'violet' : 'cyan'}>{a.interface}</Badge></td>
              <td>{a.dynamic ? <Badge tone="neutral">Dynamic</Badge> : <Badge tone="lime">Static</Badge>}</td>
              <td>{a.complete ? <Badge tone="success" dot>Yes</Badge> : <Badge tone="warn">No</Badge>}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Eye size={13} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Trash size={13} color="var(--danger)" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={ARP.length} perPage={perPage} onChange={setPage} label="ARP entry" />
    </Card>
  );
}

// ── DHCP Leases ─────────────────────────────────────────────────────────────
function DHCPLeasesTable() {
  const [page, setPage] = React.useState(1);
  const perPage = 8;
  const totalPages = Math.ceil(DHCP_LEASES.length / perPage) || 1;
  const data = DHCP_LEASES.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <table className="tbl">
        <thead><tr><th>IP / Host</th><th>MAC</th><th>Interface</th><th>Status</th><th>Expires in</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
        <tbody>
          {data.map(l => (
            <tr key={l.id}>
              <td>
                <div className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{l.address}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.hostName}</div>
              </td>
              <td className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{l.macAddress}</td>
              <td><Badge tone={l.interface.startsWith('wlan') ? 'violet' : 'cyan'}>{l.interface}</Badge></td>
              <td>{l.status === 'bound' ? <Badge tone="success" dot>Bound</Badge> : <Badge tone="warn">Waiting</Badge>}</td>
              <td className="mono" style={{ fontSize: 12 }}>{fmt.duration(l.expiresAfter)}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Lock size={13} title="Make static"/></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Trash size={13} color="var(--danger)"/></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={DHCP_LEASES.length} perPage={perPage} onChange={setPage} label="lease" />
    </Card>
  );
}

// ── Queues ──────────────────────────────────────────────────────────────────
function QueuesTable() {
  const [page, setPage] = React.useState(1);
  const perPage = 8;
  const totalPages = Math.ceil(QUEUES.length / perPage) || 1;
  const data = QUEUES.slice((page-1)*perPage, page*perPage);
  return (
    <Card style={{ padding: 0 }}>
      <table className="tbl">
        <thead><tr><th>Queue</th><th>Target</th><th>Max Limit</th><th>Current</th><th>Utilization</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
        <tbody>
          {data.map(q => {
            const utilRx = (q.curRx / q.maxLimitBps) * 100;
            const color = utilRx > 80 ? 'var(--warning)' : utilRx > 95 ? 'var(--danger)' : 'var(--accent-cyan)';
            return (
              <tr key={q.id}>
                <td><span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{q.name}</span></td>
                <td className="mono" style={{ fontSize: 12 }}>{q.target}</td>
                <td className="mono" style={{ fontSize: 12 }}>{q.maxLimit}</td>
                <td>
                  <div className="mono" style={{ fontSize: 11.5 }}>
                    <span style={{ color: 'var(--accent-cyan)' }}>↓ {fmt.rate(q.curRx)}</span><br/>
                    <span style={{ color: 'var(--accent-violet)' }}>↑ {fmt.rate(q.curTx)}</span>
                  </div>
                </td>
                <td>
                  <div style={{ minWidth: 100 }}>
                    <div className="bar"><i style={{ width: Math.min(100, utilRx) + '%', background: color }} /></div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }} className="mono">{utilRx.toFixed(0)}%</div>
                  </div>
                </td>
                <td>{q.disabled ? <Badge tone="neutral">Disabled</Badge> : <Badge tone="success" dot>Active</Badge>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Edit size={13} /></button>
                    <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Trash size={13} color="var(--danger)"/></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={QUEUES.length} perPage={perPage} onChange={setPage} label="queue" />
    </Card>
  );
}

window.NetworkScreen = NetworkScreen;
