// reports.jsx — Laporan (sales report)

function ReportsScreen({ device, chartKind }) {
  const [range, setRange] = React.useState('30d');
  const [filterProfile, setFilterProfile] = React.useState('all');
  const [filterOp, setFilterOp] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const perPage = 10;

  const filtered = TRANSACTIONS.filter(t => {
    if (filterProfile !== 'all' && t.profile !== filterProfile) return false;
    if (filterOp !== 'all' && t.operator !== filterOp) return false;
    return true;
  });
  const pageItems = filtered.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(filtered.length / perPage) || 1;

  const today = TRANSACTIONS.filter(t => new Date(t.date).toDateString() === new Date().toDateString());
  const yesterday = TRANSACTIONS.filter(t => {
    const d = new Date(t.date);
    return d.toDateString() === new Date(Date.now() - 86400000).toDateString();
  });

  const todayTotal = today.reduce((a,t) => a + t.price, 0);
  const yesterdayTotal = yesterday.reduce((a,t) => a + t.price, 0);
  const monthTotal = TRANSACTIONS.reduce((a,t) => a + t.price, 0);
  const monthCount = TRANSACTIONS.length;
  const avgTx = monthTotal / monthCount;

  // top profiles by revenue
  const topProfiles = PROFILES.map(p => ({ ...p, revenue: p.sold * p.price })).sort((a,b) => b.revenue - a.revenue);

  // by operator
  const byOperator = ['rendra','aulia','dewa','mira'].map(op => {
    const tx = TRANSACTIONS.filter(t => t.operator === op);
    return { name: op, count: tx.length, revenue: tx.reduce((a,t) => a + t.price, 0) };
  }).sort((a,b) => b.revenue - a.revenue);

  return (
    <div className="fade-in">
      <PageHeader
        title="Laporan Penjualan"
        subtitle={<>Histori transaksi voucher dari database lokal · <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{device}</b></>}
        right={(
          <>
            <Segmented value={range} onChange={setRange} options={[{value:'today',label:'Hari ini'},{value:'7d',label:'7 hari'},{value:'30d',label:'30 hari'},{value:'90d',label:'90 hari'}]} />
            <button className="btn btn-sm"><Icon.Download size={13} />Export CSV</button>
            <button className="btn btn-sm"><Icon.Print size={13} />Print</button>
          </>
        )}
      />

      {/* KPI Row */}
      <div className="grid-kpi">
        <RepKpi label="Hari ini" value={fmt.rp(todayTotal)} delta={`${today.length} transaksi`} accent="cyan" />
        <RepKpi label="Kemarin" value={fmt.rp(yesterdayTotal)} delta={`vs hari ini: ${todayTotal > yesterdayTotal ? '↑' : '↓'} ${Math.abs(((todayTotal-yesterdayTotal)/yesterdayTotal)*100).toFixed(1)}%`} accent="violet" />
        <RepKpi label="Bulan ini" value={fmt.rp(monthTotal)} delta={`${monthCount} transaksi · avg ${fmt.rpShort(avgTx)}`} accent="lime" />
        <RepKpi label="Operator terbaik" value={byOperator[0]?.name || '—'} delta={`${byOperator[0]?.count}× · ${fmt.rpShort(byOperator[0]?.revenue || 0)}`} accent="cyan" icon="Users" />
      </div>

      {/* Big chart */}
      <Card style={{ marginTop: 'var(--gap-grid)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Penjualan 30 Hari Terakhir</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }} className="tabular">{fmt.rp(REVENUE_30D.values.reduce((a,b)=>a+b,0))}</span>
              <Badge tone="lime">↑ 18.2% MoM</Badge>
            </div>
          </div>
          <Segmented value="rev" onChange={()=>{}} options={[{value:'rev',label:'Revenue'},{value:'tx',label:'Volume'}]} />
        </div>
        <Chart
          kind={chartKind}
          height={220}
          series={[{ data: REVENUE_30D.values, color: 'var(--accent-cyan)' }]}
          xLabels={Array.from({length: 6}, (_,i) => `Hari ${i*5+1}`)}
          formatY={v => fmt.rpShort(v).replace('Rp ','')}
        />
      </Card>

      {/* Breakdown row */}
      <div className="grid-2-fixed" style={{ marginTop: 'var(--gap-grid)' }}>
        {/* Top profiles */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Top Profile (revenue)</div>
          <table className="tbl" style={{ marginLeft: -12, marginRight: -12, width: 'calc(100% + 24px)' }}>
            <thead>
              <tr><th>Profile</th><th>Terjual</th><th>Avg</th><th>Total</th><th>Share</th></tr>
            </thead>
            <tbody>
              {topProfiles.map(p => {
                const share = (p.revenue / topProfiles[0].revenue) * 100;
                const color = p.color === 'cyan' ? 'var(--accent-cyan)' : p.color === 'violet' ? 'var(--accent-violet)' : 'var(--accent-lime)';
                return (
                  <tr key={p.name}>
                    <td><Badge tone={p.color}>{p.name}</Badge></td>
                    <td className="mono">{p.sold}×</td>
                    <td className="mono tabular">{fmt.rpShort(p.price)}</td>
                    <td className="mono tabular" style={{ fontWeight: 600, color }}>{fmt.rpShort(p.revenue)}</td>
                    <td>
                      <div style={{ minWidth: 80 }}>
                        <div className="bar"><i style={{ width: share+'%', background: color }} /></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* By operator */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Performa Operator</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {byOperator.map((o, i) => {
              const pct = (o.revenue / byOperator[0].revenue) * 100;
              return (
                <div key={o.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <Avatar name={o.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, textTransform: 'capitalize' }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.count} transaksi</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }} className="mono tabular">{fmt.rpShort(o.revenue)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{i === 0 ? 'Top' : `#${i+1}`}</div>
                    </div>
                  </div>
                  <div className="bar"><i style={{ width: pct + '%' }}/></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Transactions table */}
      <Card style={{ padding: 0, marginTop: 'var(--gap-grid)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Transaksi ({filtered.length})</div>
          <div style={{ flex: 1 }} />
          <select className="input input-sm select" value={filterProfile} onChange={e=>{setFilterProfile(e.target.value); setPage(1);}} style={{ width: 180 }}>
            <option value="all">Semua profile</option>
            {PROFILES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select className="input input-sm select" value={filterOp} onChange={e=>{setFilterOp(e.target.value); setPage(1);}} style={{ width: 160 }}>
            <option value="all">Semua operator</option>
            {['rendra','aulia','dewa','mira'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tanggal</th>
              <th>User / Voucher</th>
              <th>Profile</th>
              <th>Sumber</th>
              <th>Operator</th>
              <th style={{ textAlign: 'right' }}>Harga</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(t => (
              <tr key={t.id}>
                <td className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>#{t.id}</td>
                <td>
                  <div style={{ fontSize: 12.5 }} className="mono">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">{new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="mono" style={{ fontSize: 12.5 }}>{t.user}</td>
                <td><Badge tone={PROFILES.find(p=>p.name===t.profile)?.color || 'neutral'}>{t.profile}</Badge></td>
                <td>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                    {t.source === 'voucher-gen' ? <Icon.Sparkles size={12} /> : t.source === 'pos-app' ? <Icon.Ticket size={12} /> : <Icon.Edit size={12} />}
                    {t.source}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar name={t.operator} size={22} />
                    <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{t.operator}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'right' }} className="mono tabular">
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt.rp(t.price)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={perPage} onChange={setPage} label="transaksi" />
      </Card>
    </div>
  );
}

function RepKpi({ label, value, delta, accent, icon }) {
  const IconCmp = icon ? (Icon[icon] || Icon.Report) : null;
  const colorMap = { cyan: 'var(--accent-cyan)', violet: 'var(--accent-violet)', lime: 'var(--accent-lime)' };
  const bgMap = { cyan: 'var(--accent-cyan-soft)', violet: 'var(--accent-violet-soft)', lime: 'var(--accent-lime-soft)' };
  const c = colorMap[accent], bg = bgMap[accent];
  return (
    <Card accent={c}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {IconCmp ? <IconCmp size={15} /> : <Icon.Ticket size={15} />}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, letterSpacing: '-0.01em', textTransform: typeof value === 'string' && value.includes(' ') ? 'capitalize' : 'none' }} className="tabular">{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{delta}</div>
    </Card>
  );
}

window.ReportsScreen = ReportsScreen;
