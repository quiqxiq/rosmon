// overview.jsx — Dashboard overview screen.

function OverviewScreen({ device, chartKind, onScreen }) {
  const dev = DEVICES.find(d => d.id === device) || DEVICES[0];

  return (
    <div className="fade-in">
      <PageHeader
        title={`Selamat datang kembali, Rendra`}
        subtitle={<>Ringkasan operasional <b style={{ color: 'var(--text-2)', fontWeight:500 }}>{dev.slug}</b> · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</>}
        right={(
          <>
            <Segmented value="today" onChange={()=>{}} options={[{value:'today',label:'Hari ini'},{value:'7d',label:'7 hari'},{value:'30d',label:'30 hari'}]} />
            <button className="btn btn-sm"><Icon.Download size={13}/>Export</button>
          </>
        )}
      />

      {/* KPI row */}
      <div className="grid-kpi">
        <KpiCard
          label="Active Sessions"
          value={dev.active}
          delta="+12 sejak 1 jam lalu"
          trend="up"
          icon="Activity"
          accent="cyan"
          spark={[3,5,4,6,5,7,8,6,9,11,10,13,12,15,14,16,18,17]}
          live
        />
        <KpiCard
          label="Hotspot Users"
          value={dev.users}
          delta="+4 user baru hari ini"
          trend="up"
          icon="Users"
          accent="violet"
          spark={[100,120,140,160,180,210,230,260,290,310,340,360,380,400,412]}
        />
        <KpiCard
          label="Revenue Hari Ini"
          value={fmt.rpShort(478000)}
          delta="+18.4% vs kemarin"
          trend="up"
          icon="Ticket"
          accent="lime"
          spark={[5,3,4,7,9,6,8,11,9,13,12,15,18,16,21]}
        />
        <KpiCard
          label="Uptime Router"
          value={dev.uptime}
          delta={`${dev.version}`}
          trend="flat"
          icon="Power"
          accent="cyan"
          subValue={<StatusDot status={dev.status} />}
        />
      </div>

      {/* Charts row */}
      <div className="grid-2-fixed" style={{ marginTop: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500 }}>Penjualan Voucher</div>
              <div style={{ display:'flex', alignItems:'baseline', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 600, letterSpacing:'-0.02em' }}>{fmt.rp(2896000)}</span>
                <Badge tone="lime">↑ 23.5% WoW</Badge>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>7 hari terakhir · 408 transaksi</div>
            </div>
            <Segmented value="rev" onChange={()=>{}} options={[{value:'rev',label:'Revenue'},{value:'tx',label:'Transaksi'}]} />
          </div>
          <Chart
            kind={chartKind}
            height={210}
            series={[
              { data: REVENUE_7D.voucher, color: 'var(--accent-cyan)', label: 'Voucher' },
            ]}
            xLabels={REVENUE_7D.labels}
            formatY={v => fmt.rpShort(v).replace('Rp ','')}
            yTicks={4}
          />
        </Card>

        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500 }}>System Resource</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>Sehat</div>
            </div>
            <LiveTag label="LIVE · 1s" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4 }}>
            <SystemRing label="CPU" value={37} color="var(--accent-cyan)" detail="MIPSBE 880MHz" />
            <SystemRing label="RAM" value={62} color="var(--accent-violet)" detail="159 / 256 MB" />
            <SystemRing label="Disk" value={18} color="var(--accent-lime)" detail="14 / 80 MB" />
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 10, display:'flex', alignItems:'center', gap: 10 }}>
            <Icon.Zap size={14} color="var(--accent-cyan)" />
            <div style={{ fontSize: 12.5, flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Voltage / Temp</div>
              <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                <span className="mono">24.1V</span> · <span className="mono">48 °C</span> · <span className="mono">3.2W</span>
              </div>
            </div>
            <Badge tone="success">Normal</Badge>
          </div>
        </Card>
      </div>

      {/* Bottom row: traffic / activity / top profiles */}
      <div className="grid-3" style={{ marginTop: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500 }}>Traffic — ether1 (WAN)</div>
              <div style={{ display:'flex', alignItems:'center', gap: 16, marginTop: 6 }}>
                <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>RX</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>62.4 Mbps</span>
                </span>
                <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-violet)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>TX</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>24.1 Mbps</span>
                </span>
              </div>
            </div>
            <Segmented value="24h" onChange={()=>{}} options={['24h','7d']} />
          </div>
          <Chart
            kind={chartKind}
            height={170}
            series={[
              { data: TRAFFIC_24H.rx, color: 'var(--accent-cyan)' },
              { data: TRAFFIC_24H.tx, color: 'var(--accent-violet)' },
            ]}
            xLabels={TRAFFIC_24H.labels}
            formatY={v => `${Math.round(v)}M`}
            yTicks={3}
          />
        </Card>

        <Card style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Aktivitas Terkini</div>
            <button className="btn btn-ghost btn-xs" onClick={()=>onScreen?.('sessions')}>Lihat semua</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 2, flex: 1 }}>
            {ACTIVITY.slice(0, 6).map((a, i) => <ActivityItem key={i} a={a} />)}
          </div>
        </Card>

        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Top Profile Hari Ini</div>
            <button className="btn btn-ghost btn-xs"><Icon.More size={14} /></button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            {PROFILES.slice(0, 4).map((p, i) => {
              const max = Math.max(...PROFILES.map(x => x.sold));
              const pct = (p.sold / max) * 100;
              return (
                <div key={p.name}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6, alignItems:'baseline' }}>
                    <span style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 13 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: p.color === 'cyan' ? 'var(--accent-cyan-soft)' : p.color === 'violet' ? 'var(--accent-violet-soft)' : 'var(--accent-lime-soft)',
                        color: p.color === 'cyan' ? 'var(--accent-cyan)' : p.color === 'violet' ? 'var(--accent-violet)' : 'var(--accent-lime)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize: 10, fontWeight: 600,
                      }}>
                        <Icon.Ticket size={12} />
                      </span>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sold}× · {fmt.rpShort(p.sold * p.price)}</span>
                  </div>
                  <div className="bar">
                    <i style={{
                      width: pct + '%',
                      background: p.color === 'cyan'
                        ? 'linear-gradient(90deg, var(--accent-cyan), #67E3F4)'
                        : p.color === 'violet'
                        ? 'linear-gradient(90deg, var(--accent-violet), #B292FF)'
                        : 'linear-gradient(90deg, var(--accent-lime), #C5F36C)'
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid-3" style={{ marginTop: 'var(--gap-grid)' }}>
        <QuickAction icon="Ticket" title="Generate Voucher" desc="Batch baru dengan profile pilihan" color="cyan" onClick={()=>onScreen?.('voucher')} />
        <QuickAction icon="Plus"   title="Tambah User"      desc="Manual create hotspot user" color="violet" onClick={()=>onScreen?.('users')} />
        <QuickAction icon="Activity" title="Lihat Sessions" desc="Monitor real-time pemakaian" color="lime" onClick={()=>onScreen?.('sessions')} />
        <QuickAction icon="Report" title="Laporan Penjualan" desc="Export bulanan ke CSV" color="cyan" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, trend, icon, accent, spark, subValue, live }) {
  const IconCmp = Icon[icon] || Icon.Activity;
  const color = accent === 'violet' ? 'var(--accent-violet)' : accent === 'lime' ? 'var(--accent-lime)' : 'var(--accent-cyan)';
  const tintBg = accent === 'violet' ? 'var(--accent-violet-soft)' : accent === 'lime' ? 'var(--accent-lime-soft)' : 'var(--accent-cyan-soft)';
  const trendColor = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--muted)';

  return (
    <Card style={{ position: 'relative', overflow: 'hidden' }} accent={color}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: tintBg, color: color,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <IconCmp size={16} />
        </div>
        {live && <LiveTag />}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.01em' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {subValue}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11.5, color: trendColor, display:'flex', alignItems:'center', gap: 3 }}>
          {trend === 'up' ? <Icon.Up size={11} strokeWidth={2.5} /> : trend === 'down' ? <Icon.Down size={11} strokeWidth={2.5} /> : null}
          {delta}
        </span>
        {spark && <Spark data={spark} color={color} kind="area" width={70} height={22} />}
      </div>
    </Card>
  );
}

function SystemRing({ label, value, color, detail }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 8, padding: '8px 4px', background: 'var(--bg-2)', borderRadius: 10 }}>
      <Ring value={value} size={78} stroke={7} color={color} label={`${value}%`} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }} className="mono">{detail}</div>
      </div>
    </div>
  );
}

function ActivityItem({ a }) {
  const map = {
    login: { icon: 'ArrowUpRight', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-soft)' },
    sale:  { icon: 'Ticket',       color: 'var(--accent-lime)', bg: 'var(--accent-lime-soft)' },
    kick:  { icon: 'Kick',         color: 'var(--danger)',     bg: 'rgba(244,63,94,0.12)' },
    expiry:{ icon: 'Clock',        color: 'var(--warning)',    bg: 'rgba(245,158,11,0.12)' },
  };
  const m = map[a.type] || map.login;
  const IconCmp = Icon[m.icon] || Icon.Activity;
  return (
    <div className="row-hover" style={{ display:'flex', alignItems:'center', gap: 10, padding: '8px 6px', borderRadius: 8, cursor:'default' }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: m.bg, color: m.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
        <IconCmp size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          <span style={{ fontWeight: 500 }}>{a.user}</span>{' '}
          <span style={{ color: 'var(--muted)' }}>{a.detail}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted-2)', flexShrink: 0 }}>{fmt.ago(a.t)}</span>
    </div>
  );
}

function QuickAction({ icon, title, desc, color, onClick }) {
  const IconCmp = Icon[icon] || Icon.Plus;
  const c = color === 'violet' ? 'var(--accent-violet)' : color === 'lime' ? 'var(--accent-lime)' : 'var(--accent-cyan)';
  const bg = color === 'violet' ? 'var(--accent-violet-soft)' : color === 'lime' ? 'var(--accent-lime-soft)' : 'var(--accent-cyan-soft)';
  return (
    <Card style={{ cursor:'pointer', transition: 'all 160ms', display:'flex', alignItems:'center', gap: 12 }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: bg, color: c,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink: 0,
      }}>
        <IconCmp size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13.5 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <Icon.Chevron size={14} color="var(--muted)" />
    </Card>
  );
}

window.OverviewScreen = OverviewScreen;
