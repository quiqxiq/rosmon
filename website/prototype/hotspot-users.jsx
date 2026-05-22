// hotspot-users.jsx — Hotspot users CRUD table screen.

function HotspotUsersScreen({ device }) {
  const [users, setUsers] = React.useState(HS_USERS);
  const [search, setSearch] = React.useState('');
  const [filterProfile, setFilterProfile] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterServer, setFilterServer] = React.useState('all');
  const [selected, setSelected] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const [editingUser, setEditingUser] = React.useState(null); // user or {} for new
  const perPage = 9;

  const filtered = users.filter(u => {
    if (search) {
      const s = search.toLowerCase();
      if (!(u.name.toLowerCase().includes(s) || (u.mac||'').toLowerCase().includes(s) || u.profile.toLowerCase().includes(s))) return false;
    }
    if (filterProfile !== 'all' && u.profile !== filterProfile) return false;
    if (filterServer !== 'all' && u.server !== filterServer) return false;
    if (filterStatus === 'active' && !u.isActive) return false;
    if (filterStatus === 'inactive' && u.isActive) return false;
    if (filterStatus === 'disabled' && !u.disabled) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const pageItems = filtered.slice((page-1)*perPage, page*perPage);

  React.useEffect(()=>{ setPage(1); }, [search, filterProfile, filterStatus, filterServer]);

  const allSelected = pageItems.length > 0 && pageItems.every(u => selected.has(u.id));
  const toggleAll = () => {
    const n = new Set(selected);
    if (allSelected) pageItems.forEach(u => n.delete(u.id));
    else pageItems.forEach(u => n.add(u.id));
    setSelected(n);
  };

  const toggleOne = id => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  const deleteSelected = () => {
    setUsers(u => u.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  };

  const toggleDisabled = (id) => {
    setUsers(u => u.map(x => x.id === id ? { ...x, disabled: !x.disabled } : x));
  };

  const saveUser = (u) => {
    if (u.id) {
      setUsers(arr => arr.map(x => x.id === u.id ? { ...x, ...u } : x));
    } else {
      const newU = { ...u, id: `*N${Math.floor(Math.random()*999).toString(16).toUpperCase()}`, uptime: 0, bytesIn: 0, bytesOut: 0, isActive: false, disabled: false };
      setUsers(arr => [newU, ...arr]);
    }
    setEditingUser(null);
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Hotspot Users"
        subtitle={<>CRUD user hotspot pada <b style={{ color: 'var(--text-2)', fontWeight:500 }}>{device}</b> · {filtered.length} dari {users.length} user</>}
        right={(
          <>
            <button className="btn btn-sm"><Icon.Download size={13}/>Export CSV</button>
            <button className="btn btn-sm"><Icon.Refresh size={13}/>Reload</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setEditingUser({})}>
              <Icon.Plus size={14}/>Tambah User
            </button>
          </>
        )}
      />

      {/* Summary chips */}
      <div style={{ display:'flex', gap: 10, marginBottom: 16, flexWrap:'wrap' }}>
        <SummaryChip label="Total" value={users.length} accent="cyan" />
        <SummaryChip label="Aktif sekarang" value={users.filter(u=>u.isActive).length} accent="lime" />
        <SummaryChip label="Disabled" value={users.filter(u=>u.disabled).length} accent="violet" />
        <SummaryChip label="Akan expired (24j)" value={users.filter(u => u.expiry < Date.now() + 86400000 && u.expiry > Date.now()).length} accent="warn" />
        <SummaryChip label="Sudah expired" value={users.filter(u => u.expiry < Date.now()).length} accent="danger" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', flexWrap:'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, MAC, profile..." />
          <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
            <FilterSelect value={filterProfile} onChange={setFilterProfile}
              options={[{value:'all',label:'Semua profile'}, ...PROFILES.map(p=>({value:p.name,label:p.name}))]} />
            <FilterSelect value={filterServer} onChange={setFilterServer}
              options={[{value:'all',label:'Semua server'},{value:'hotspot1',label:'hotspot1'},{value:'hotspot2',label:'hotspot2'}]} />
            <FilterSelect value={filterStatus} onChange={setFilterStatus}
              options={[{value:'all',label:'Semua status'},{value:'active',label:'Aktif'},{value:'inactive',label:'Tidak aktif'},{value:'disabled',label:'Disabled'}]} />
          </div>
          <div style={{ flex: 1 }} />
          {selected.size > 0 && (
            <div className="fade-in" style={{ display:'flex', alignItems:'center', gap: 8, padding: '6px 10px', background: 'var(--accent-cyan-soft)', borderRadius: 8, color: 'var(--accent-cyan)' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{selected.size} dipilih</span>
              <button className="btn btn-xs btn-ghost" onClick={()=>setSelected(new Set())}>Batal</button>
              <button className="btn btn-xs btn-danger" onClick={deleteSelected}>
                <Icon.Trash size={11} /> Hapus
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" className="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>User</th>
              <th>Profile</th>
              <th>Server</th>
              <th>Status</th>
              <th>Uptime</th>
              <th>Pemakaian</th>
              <th>Expiry</th>
              <th style={{ width: 100, textAlign:'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(u => <UserRow key={u.id} user={u} selected={selected.has(u.id)} onToggle={()=>toggleOne(u.id)} onEdit={()=>setEditingUser(u)} onToggleDisabled={()=>toggleDisabled(u.id)} />)}
            {pageItems.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign:'center', padding: '60px 20px', color: 'var(--muted)' }}>
                <Icon.Users size={32} color="var(--muted-2)" style={{ marginBottom: 8 }} />
                <div>Tidak ada user yang cocok dengan filter</div>
              </td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={perPage} onChange={setPage} label="user" />
      </Card>

      {editingUser && (
        <UserDrawer user={editingUser} onSave={saveUser} onClose={()=>setEditingUser(null)} />
      )}
    </div>
  );
}

function SummaryChip({ label, value, accent }) {
  const color = {
    cyan: 'var(--accent-cyan)', violet: 'var(--accent-violet)', lime: 'var(--accent-lime)',
    warn: 'var(--warning)', danger: 'var(--danger)',
  }[accent];
  return (
    <div style={{
      display:'flex', alignItems:'baseline', gap: 8,
      padding: '8px 14px',
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 999,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select className="input input-sm select" style={{ width: 'auto', minWidth: 140 }} value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function UserRow({ user, selected, onToggle, onEdit, onToggleDisabled }) {
  const isExpired = user.expiry < Date.now();
  const expiresIn = user.expiry - Date.now();
  const expiresSoon = expiresIn > 0 && expiresIn < 86400000;

  const total = user.bytesIn + user.bytesOut;
  const max = 10e9;
  const pct = Math.min(100, (total / max) * 100);

  return (
    <tr style={{ background: selected ? 'var(--bg-active)' : '' }}>
      <td>
        <input type="checkbox" className="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <Avatar name={user.name} size={28} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">{user.mac || '—'}</div>
          </div>
        </div>
      </td>
      <td><Badge tone={PROFILES.find(p=>p.name===user.profile)?.color || 'neutral'}>{user.profile}</Badge></td>
      <td><span style={{ fontSize: 12, color: 'var(--muted)' }} className="mono">{user.server}</span></td>
      <td>
        {user.disabled ? <Badge tone="neutral"><Icon.Lock size={10}/> Disabled</Badge>
          : user.isActive ? <Badge tone="success" dot>Online</Badge>
          : <Badge tone="neutral">Offline</Badge>}
      </td>
      <td className="mono" style={{ fontSize: 12 }}>{fmt.duration(user.uptime)}</td>
      <td>
        <div style={{ minWidth: 130 }}>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            ↓{fmt.bytes(user.bytesIn)} · ↑{fmt.bytes(user.bytesOut)}
          </div>
          <div className="bar" style={{ marginTop: 4, height: 4 }}>
            <i style={{ width: pct + '%' }} />
          </div>
        </div>
      </td>
      <td>
        <span className="mono" style={{ fontSize: 12, color: isExpired ? 'var(--danger)' : expiresSoon ? 'var(--warning)' : 'var(--text-2)' }}>
          {isExpired ? 'Expired' : new Date(user.expiry).toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) + ' ' + new Date(user.expiry).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
        </span>
      </td>
      <td>
        <div style={{ display:'flex', gap: 4, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} onClick={onToggleDisabled} title={user.disabled ? 'Aktifkan' : 'Disable'}>
            {user.disabled ? <Icon.Power size={13} color="var(--muted)" /> : <Icon.Power size={13} color="var(--success)" />}
          </button>
          <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} onClick={onEdit} title="Edit">
            <Icon.Edit size={13} />
          </button>
          <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} title="Lainnya">
            <Icon.More size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserDrawer({ user, onSave, onClose }) {
  const isNew = !user.id;
  const [form, setForm] = React.useState({
    name: user.name || '',
    password: user.password || '',
    profile: user.profile || PROFILES[0].name,
    server: user.server || 'hotspot1',
    mac: user.mac || '',
    comment: user.comment || '',
    expiry: user.expiry || Date.now() + 86400000,
    ...user,
  });
  const [tab, setTab] = React.useState('general');
  const [showPw, setShowPw] = React.useState(false);

  const upd = (k,v) => setForm(f => ({...f, [k]:v}));

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 500 }}>
                {isNew ? 'Tambah User' : 'Edit User'}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 6 }}>
                {!isNew && <Avatar name={form.name} size={32} />}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{isNew ? 'Hotspot user baru' : form.name}</div>
                  {!isNew && <div style={{ fontSize: 12, color: 'var(--muted)' }} className="mono">{user.id}</div>}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon.X size={16} /></button>
          </div>
          <div className="seg" style={{ marginTop: 14 }}>
            <button className={tab==='general'?'on':''} onClick={()=>setTab('general')}>General</button>
            <button className={tab==='limits'?'on':''} onClick={()=>setTab('limits')}>Limits</button>
            <button className={tab==='stats'?'on':''} onClick={()=>setTab('stats')}>Statistik</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
          {tab === 'general' && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <Field label="Username" required>
                <input className="input" value={form.name} onChange={e=>upd('name', e.target.value)} placeholder="cth: budi088" />
              </Field>
              <Field label="Password" hint="Kosongkan untuk tetap pakai password lama">
                <div style={{ position:'relative' }}>
                  <input className="input" type={showPw?'text':'password'} value={form.password} onChange={e=>upd('password', e.target.value)} placeholder="••••••••" style={{ paddingRight: 36 }} />
                  <button className="btn btn-ghost btn-icon" style={{ position:'absolute', right: 4, top: 4, width: 28, height: 28 }} onClick={()=>setShowPw(s=>!s)}>
                    {showPw ? <Icon.EyeOff size={14} /> : <Icon.Eye size={14} />}
                  </button>
                </div>
              </Field>
              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Profile">
                  <select className="input select" value={form.profile} onChange={e=>upd('profile', e.target.value)}>
                    {PROFILES.map(p => <option key={p.name} value={p.name}>{p.name} — {fmt.rpShort(p.price)}</option>)}
                  </select>
                </Field>
                <Field label="Server">
                  <select className="input select" value={form.server} onChange={e=>upd('server', e.target.value)}>
                    <option>hotspot1</option><option>hotspot2</option>
                  </select>
                </Field>
              </div>
              <Field label="MAC Address Lock" hint="Bind user ke MAC tertentu (opsional)">
                <input className="input mono" value={form.mac} onChange={e=>upd('mac', e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
              </Field>
              <Field label="Komentar">
                <input className="input" value={form.comment} onChange={e=>upd('comment', e.target.value)} placeholder="batch voucher, catatan, dll." />
              </Field>
            </div>
          )}

          {tab === 'limits' && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <Field label="Validity" hint="Mengikuti profile-config server">
                <select className="input select" defaultValue="1d">
                  <option value="1h">1 Jam</option><option value="6h">6 Jam</option><option value="1d">1 Hari</option><option value="7d">7 Hari</option><option value="30d">30 Hari</option>
                </select>
              </Field>
              <Field label="Limit Uptime">
                <input className="input mono" defaultValue="1d 00:00:00" />
              </Field>
              <Field label="Limit Bytes Total">
                <input className="input mono" defaultValue="0 (tidak terbatas)" />
              </Field>
              <Field label="Limit Bytes In / Out">
                <div style={{ display:'flex', gap: 8 }}>
                  <input className="input mono" defaultValue="0" placeholder="In" />
                  <input className="input mono" defaultValue="0" placeholder="Out" />
                </div>
              </Field>
              <div style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 10, display:'flex', alignItems:'flex-start', gap: 10 }}>
                <Icon.Zap size={16} color="var(--accent-cyan)" style={{ marginTop: 1 }} />
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Profile <b style={{ color: 'var(--text-2)' }}>{form.profile}</b> mengeset rate-limit <span className="mono">{PROFILES.find(p=>p.name===form.profile)?.speed}</span> dan validity <span className="mono">{PROFILES.find(p=>p.name===form.profile)?.validity}</span> secara default.
                </div>
              </div>
            </div>
          )}

          {tab === 'stats' && !isNew && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatBlock label="Uptime" value={fmt.duration(user.uptime)} />
                <StatBlock label="Sesi terakhir" value={user.isActive ? 'Sedang online' : '2 jam lalu'} />
                <StatBlock label="Bytes In" value={fmt.bytes(user.bytesIn)} accent="cyan" />
                <StatBlock label="Bytes Out" value={fmt.bytes(user.bytesOut)} accent="violet" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Pemakaian 7 hari (MB)</div>
                <Chart height={140} series={[{ data: [120, 80, 240, 180, 320, 200, 410], color: 'var(--accent-cyan)' }]} xLabels={['S','S','R','K','J','S','M']} kind="area" formatY={v=>Math.round(v)} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 18, borderTop: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap: 10 }}>
          <div style={{ display:'flex', gap: 8 }}>
            {!isNew && (
              <>
                <button className="btn btn-sm">Reset Counter</button>
                <button className="btn btn-sm btn-danger">Hapus</button>
              </>
            )}
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose}>Batal</button>
            <button className="btn btn-primary btn-sm" onClick={()=>onSave({ ...user, ...form })}>
              <Icon.Check size={13} /> {isNew ? 'Buat User' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatBlock({ label, value, accent }) {
  const c = accent === 'cyan' ? 'var(--accent-cyan)' : accent === 'violet' ? 'var(--accent-violet)' : 'var(--text)';
  return (
    <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: c, fontVariantNumeric:'tabular-nums' }} className="mono">{value}</div>
    </div>
  );
}

window.HotspotUsersScreen = HotspotUsersScreen;
