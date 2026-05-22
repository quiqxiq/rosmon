// ppp.jsx — PPP screen with tabs: Secret / Active / Profile / Inactive

function PPPScreen({ device, chartKind }) {
  const [tab, setTab] = React.useState('secret');
  const [search, setSearch] = React.useState('');

  const counts = {
    secret: PPP_SECRETS.length,
    active: PPP_ACTIVE.length,
    profile: PPP_PROFILES.length,
    inactive: PPP_SECRETS.filter(s => !s.isActive).length,
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="PPP"
        subtitle={<>Manajemen PPPoE secret, active session, profile, dan inactive secret untuk <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{device}</b></>}
        right={(
          <>
            <button className="btn btn-sm"><Icon.Refresh size={13} />Reload</button>
            {tab === 'secret' && <button className="btn btn-primary btn-sm"><Icon.Plus size={13} />Tambah Secret</button>}
            {tab === 'profile' && <button className="btn btn-primary btn-sm"><Icon.Plus size={13} />Tambah Profile</button>}
          </>
        )}
      />

      {/* Big tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        <PPPTab id="secret"   active={tab==='secret'}   onClick={()=>setTab('secret')}   label="Secret"   count={counts.secret}   icon="Lock" />
        <PPPTab id="active"   active={tab==='active'}   onClick={()=>setTab('active')}   label="Active"   count={counts.active}   icon="Activity" live />
        <PPPTab id="profile"  active={tab==='profile'}  onClick={()=>setTab('profile')}  label="Profile"  count={counts.profile}  icon="Wifi" />
        <PPPTab id="inactive" active={tab==='inactive'} onClick={()=>setTab('inactive')} label="Inactive" count={counts.inactive} icon="Power" />
      </div>

      {/* Toolbar */}
      {tab !== 'profile' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <SearchInput value={search} onChange={setSearch} placeholder={`Cari di ${tab}...`} />
          <button className="btn btn-sm"><Icon.Filter size={13} />Filter</button>
          <button className="btn btn-sm"><Icon.Download size={13} />Export</button>
        </div>
      )}

      {tab === 'secret'   && <PPPSecretTable   search={search} />}
      {tab === 'active'   && <PPPActiveTable   search={search} chartKind={chartKind} />}
      {tab === 'profile'  && <PPPProfileGrid />}
      {tab === 'inactive' && <PPPInactiveTable search={search} />}
    </div>
  );
}

function PPPTab({ active, onClick, label, count, icon, live }) {
  const IconCmp = Icon[icon] || Icon.Lock;
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 0, background: 'transparent',
        padding: '12px 16px',
        color: active ? 'var(--text)' : 'var(--muted)',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
        cursor: 'pointer',
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'color 140ms',
        marginBottom: -1,
      }}
    >
      <IconCmp size={15} color={active ? 'var(--accent-cyan)' : undefined} />
      {label}
      <span style={{
        fontSize: 11, color: 'var(--muted)',
        padding: '1px 7px', borderRadius: 999,
        background: active ? 'var(--accent-cyan-soft)' : 'var(--bg-2)',
        color: active ? 'var(--accent-cyan)' : 'var(--muted)',
        border: '1px solid var(--border)',
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
      {live && <span className="dot dot-live" style={{ background: 'var(--success)' }} />}
      {active && <div style={{ position: 'absolute', left: 12, right: 12, bottom: -1, height: 2, background: 'var(--accent-cyan)', borderRadius: 2 }} />}
    </button>
  );
}

// ── Secret tab ──────────────────────────────────────────────────────────────
function PPPSecretTable({ search }) {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const all = PPP_SECRETS.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.profile.toLowerCase().includes(q) || (s.comment||'').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(all.length / perPage) || 1;
  const data = all.slice((page-1)*perPage, page*perPage);
  React.useEffect(() => { setPage(1); }, [search]);
  return (
    <Card style={{ padding: 0 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" className="checkbox" /></th>
            <th>Name</th>
            <th>Profile</th>
            <th>Service</th>
            <th>Remote Address</th>
            <th>Caller ID</th>
            <th>Status</th>
            <th>Last logout</th>
            <th style={{ textAlign: 'right' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.map(s => (
            <tr key={s.id}>
              <td><input type="checkbox" className="checkbox" /></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon.Lock size={13} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }} className="mono">{s.name}</div>
                    {s.comment && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.comment}</div>}
                  </div>
                </div>
              </td>
              <td><Badge tone="violet">{s.profile}</Badge></td>
              <td><span className="mono" style={{ fontSize: 12 }}>{s.service}</span></td>
              <td className="mono" style={{ fontSize: 12 }}>{s.address}</td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{s.callerId || '—'}</td>
              <td>
                {s.disabled ? <Badge tone="neutral"><Icon.Lock size={10} /> Disabled</Badge>
                  : s.isActive ? <Badge tone="success" dot>Online</Badge>
                  : <Badge tone="neutral">Offline</Badge>}
              </td>
              <td>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {fmt.ago((Date.now() - s.lastLoggedOut) / 1000)} lalu
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Power size={13} color={s.disabled ? 'var(--muted)' : 'var(--success)'} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Edit size={13} /></button>
                  <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.More size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} total={all.length} perPage={perPage} onChange={setPage} label="secret" />
    </Card>
  );
}

// ── Active tab ──────────────────────────────────────────────────────────────
function PPPActiveTable({ search, chartKind }) {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const all = PPP_ACTIVE.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(all.length / perPage) || 1;
  const data = all.slice((page-1)*perPage, page*perPage);
  React.useEffect(() => { setPage(1); }, [search]);
  const totalRx = all.reduce((a,s) => a + s.rxRate, 0);
  const totalTx = all.reduce((a,s) => a + s.txRate, 0);
  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total Session Aktif</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{data.length}</div>
          <LiveTag />
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Throughput RX</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: 'var(--accent-cyan)' }} className="mono">{fmt.rate(totalRx)}</div>
          <Spark data={[8,12,10,15,18,14,22,20,24,28]} color="var(--accent-cyan)" kind="area" width={120} height={28} />
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Throughput TX</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: 'var(--accent-violet)' }} className="mono">{fmt.rate(totalTx)}</div>
          <Spark data={[5,8,7,9,12,10,14,11,15,18]} color="var(--accent-violet)" kind="area" width={120} height={28} />
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Encoding</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }} className="mono">MPPE128</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>RFC 3078 · auto-negotiated</div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Profile</th>
              <th>Address</th>
              <th>Caller ID</th>
              <th>Uptime</th>
              <th>Throughput</th>
              <th>Bytes</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => {
              const uptimeSec = Math.floor((Date.now() - s.uptimeStart) / 1000);
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar name={s.name} size={28} />
                        <span className="dot-live" style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-1)' }} />
                      </div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    </div>
                  </td>
                  <td><Badge tone="violet">{s.profile}</Badge></td>
                  <td className="mono" style={{ fontSize: 12 }}>{s.address}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{s.callerId}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmt.duration(uptimeSec)}</td>
                  <td>
                    <div className="mono" style={{ fontSize: 11.5 }}>
                      <span style={{ color: 'var(--accent-cyan)' }}>↓ {fmt.rate(s.rxRate)}</span><br/>
                      <span style={{ color: 'var(--accent-violet)' }}>↑ {fmt.rate(s.txRate)}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmt.bytes(s.bytesIn + s.bytesOut)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.Eye size={13} /></button>
                      <button className="btn btn-danger btn-icon" style={{ width: 28, height: 28 }}><Icon.Kick size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={all.length} perPage={perPage} onChange={setPage} label="session aktif" />
      </Card>
    </>
  );
}

// ── Profile tab ─────────────────────────────────────────────────────────────
function PPPProfileGrid() {
  return (
    <div className="grid-3">
      {PPP_PROFILES.map(p => (
        <Card key={p.id} style={{ position: 'relative' }} accent="var(--accent-violet)">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-violet-soft)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Wifi size={18} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">{p.id}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}><Icon.More size={14} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <KV label="Rate Limit" value={p.rateLimit} accent="cyan" />
            <KV label="Sessions" value={p.sessions} accent="violet" />
            <KV label="Local" value={p.localAddress} />
            <KV label="Pool" value={p.remoteAddress} />
            <KV label="DNS" value={p.dnsServer} style={{ gridColumn: 'span 2' }} />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" style={{ flex: 1 }}><Icon.Edit size={12} />Edit</button>
            <button className="btn btn-sm" style={{ flex: 1 }}><Icon.Users size={12} />Lihat user</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function KV({ label, value, accent, style }) {
  const c = accent === 'cyan' ? 'var(--accent-cyan)' : accent === 'violet' ? 'var(--accent-violet)' : 'var(--text)';
  return (
    <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 7, ...style }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

// ── Inactive tab ────────────────────────────────────────────────────────────
function PPPInactiveTable({ search }) {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const all = PPP_SECRETS
    .filter(s => !s.isActive)
    .sort((a,b) => a.lastLoggedOut - b.lastLoggedOut)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(all.length / perPage) || 1;
  const data = all.slice((page-1)*perPage, page*perPage);
  React.useEffect(() => { setPage(1); }, [search]);

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Inactive saat ini</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: 'var(--warning)' }}>{data.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{Math.round(data.length/PPP_SECRETS.length*100)}% dari total secret</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tidak login &gt; 7 hari</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{data.filter(s => Date.now() - s.lastLoggedOut > 7*86400000).length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Kandidat untuk review</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Disabled</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: 'var(--muted)' }}>{PPP_SECRETS.filter(s => s.disabled).length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Manual disable oleh admin</div>
        </Card>
        <Card style={{ background: 'linear-gradient(135deg, var(--accent-cyan-soft), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon.Sparkles size={18} color="var(--accent-cyan)" />
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Aksi cepat</div>
              <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Disable semua yang tidak login &gt; 30 hari untuk audit.</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }}>Jalankan</button>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Secret</th>
              <th>Profile</th>
              <th>Last seen</th>
              <th>Status</th>
              <th>Komentar</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => {
              const sinceDays = (Date.now() - s.lastLoggedOut) / 86400000;
              const tone = sinceDays > 7 ? 'danger' : sinceDays > 3 ? 'warn' : 'neutral';
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={s.name} size={28} />
                      <div className="mono" style={{ fontSize: 13 }}>{s.name}</div>
                    </div>
                  </td>
                  <td><Badge tone="violet">{s.profile}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge tone={tone}>{fmt.ago((Date.now() - s.lastLoggedOut)/1000)} lalu</Badge>
                    </div>
                  </td>
                  <td>
                    {s.disabled ? <Badge tone="neutral">Disabled</Badge> : <Badge tone="warn">Inactive</Badge>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.comment || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Aktifkan"><Icon.Power size={13} /></button>
                      <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Edit"><Icon.Edit size={13} /></button>
                      <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Hapus"><Icon.Trash size={13} color="var(--danger)" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={all.length} perPage={perPage} onChange={setPage} label="inactive secret" />
      </Card>
    </>
  );
}

window.PPPScreen = PPPScreen;
