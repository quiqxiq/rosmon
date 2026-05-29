// hotspot-profiles.jsx — Hotspot profile management (router + mikhmon profile-config)

function HotspotProfilesScreen({ device }) {
  const [selected, setSelected] = React.useState(null);

  return (
    <div className="fade-in">
      <PageHeader
        title="Hotspot Profiles"
        subtitle={<>Profile router + konfigurasi mikhmon (validity, harga, expiry mode) untuk <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{device}</b></>}
        right={(
          <>
            <button className="btn btn-sm"><Icon.Refresh size={13} />Sync ke router</button>
            <button className="btn btn-primary btn-sm"><Icon.Plus size={13} />Tambah Profile</button>
          </>
        )}
      />

      {/* Summary */}
      <div className="grid-kpi" style={{ marginBottom: 'var(--gap-grid)' }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total Profile</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{PROFILES.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>5 paket aktif · 0 draft</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Voucher terjual (bulan ini)</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }} className="tabular">{PROFILES.reduce((a,p)=>a+p.sold,0).toLocaleString('id-ID')}</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>↑ 12.4% MoM</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pendapatan kotor</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: 'var(--accent-lime)' }}>{fmt.rpShort(PROFILES.reduce((a,p)=>a+p.sold*p.price,0))}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Sumber: report local DB</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Average Revenue / Voucher</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmt.rpShort(PROFILES.reduce((a,p)=>a+p.sold*p.price,0) / PROFILES.reduce((a,p)=>a+p.sold,0))}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Sweet spot: 1HARI-10K</div>
        </Card>
      </div>

      {/* Profile cards grid */}
      <div className="grid-3">
        {PROFILES.map(p => (
          <ProfileCard key={p.name} profile={p} onClick={() => setSelected(p)} />
        ))}
        <AddProfileCard />
      </div>

      {selected && <ProfileConfigDrawer profile={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ProfileCard({ profile, onClick }) {
  const color = profile.color === 'cyan' ? 'var(--accent-cyan)' : profile.color === 'violet' ? 'var(--accent-violet)' : 'var(--accent-lime)';
  const bg    = profile.color === 'cyan' ? 'var(--accent-cyan-soft)' : profile.color === 'violet' ? 'var(--accent-violet-soft)' : 'var(--accent-lime-soft)';
  const max = Math.max(...PROFILES.map(p => p.sold));
  const pct = (profile.sold / max) * 100;

  return (
    <Card
      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'transform 160ms' }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
      accent={color}
    >
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: bg, opacity: 0.5 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.Ticket size={18} />
        </div>
        <Badge tone={profile.color}>{profile.validity}</Badge>
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{profile.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: color, letterSpacing: '-0.02em' }} className="mono tabular">{fmt.rpShort(profile.price)}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ voucher</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <Mini icon="Zap" label="Speed" value={profile.speed} />
        <Mini icon="Clock" label="Validity" value={profile.validity} />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Terjual bulan ini</span>
          <span style={{ fontSize: 12, fontWeight: 600 }} className="mono tabular">{profile.sold}×</span>
        </div>
        <div className="bar"><i style={{ width: pct + '%', background: `linear-gradient(90deg, ${color}, ${color})` }} /></div>
      </div>
    </Card>
  );
}

function Mini({ icon, label, value }) {
  const IconCmp = Icon[icon] || Icon.Zap;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <IconCmp size={13} color="var(--muted)" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 500 }} className="mono">{value}</div>
      </div>
    </div>
  );
}

function AddProfileCard() {
  return (
    <button
      style={{
        appearance: 'none',
        background: 'transparent',
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--pad-card)',
        color: 'var(--muted)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 220,
        fontFamily: 'inherit',
        transition: 'all 160ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon.Plus size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>Tambah Profile Baru</div>
      <div style={{ fontSize: 11.5, textAlign: 'center', maxWidth: 200, color: 'var(--muted)' }}>
        Buat paket voucher dengan validity, harga, dan rate-limit kustom.
      </div>
    </button>
  );
}

function ProfileConfigDrawer({ profile, onClose }) {
  const color = profile.color === 'cyan' ? 'var(--accent-cyan)' : profile.color === 'violet' ? 'var(--accent-violet)' : 'var(--accent-lime)';
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 480 }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Profile Config</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, color: color }}>{profile.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Endpoint: <span className="mono">/hotspot/profile-configs/{profile.name}</span></div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon.X size={16} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Router Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Rate Limit (RX/TX)">
              <input className="input mono" defaultValue={profile.speed} />
            </Field>
            <Field label="Shared Users">
              <input className="input mono" type="number" defaultValue="1" />
            </Field>
            <Field label="Session Timeout">
              <input className="input mono" defaultValue="01:00:00" />
            </Field>
            <Field label="Idle Timeout">
              <input className="input mono" defaultValue="00:05:00" />
            </Field>
            <Field label="Address Pool" style={{ gridColumn: 'span 2' }}>
              <select className="input select"><option>pool-hotspot</option></select>
            </Field>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginTop: 4 }}>Mikhmon Config</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Harga jual">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }}>Rp</span>
                <input className="input mono tabular" type="number" defaultValue={profile.price} style={{ paddingLeft: 32 }} />
              </div>
            </Field>
            <Field label="Validity setelah login">
              <select className="input select" defaultValue={profile.validity}>
                <option value="1h">1 Jam</option><option value="3h">3 Jam</option><option value="6h">6 Jam</option>
                <option value="1d">1 Hari</option><option value="7d">7 Hari</option><option value="30d">30 Hari</option>
              </select>
            </Field>
            <Field label="Expiry Mode" hint="Notice/Disable/Delete">
              <select className="input select" defaultValue="disable">
                <option value="notice">Notice (warning)</option>
                <option value="disable">Disable user</option>
                <option value="delete">Delete user</option>
              </select>
            </Field>
            <Field label="Lock to MAC">
              <div className="seg" style={{ width: '100%' }}>
                <button className="on" style={{ flex: 1 }}>On</button>
                <button style={{ flex: 1 }}>Off</button>
              </div>
            </Field>
          </div>

          {/* Stats */}
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginTop: 4 }}>Statistik 30 hari</div>
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total terjual</div>
                <div style={{ fontSize: 20, fontWeight: 600 }} className="tabular">{profile.sold}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pendapatan</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: color }} className="tabular">{fmt.rpShort(profile.sold * profile.price)}</div>
              </div>
            </div>
            <Spark data={[8, 14, 11, 19, 22, 17, 25, 21, 28, 24, 31, 36, 30, 42, 38]} color={color} kind="area" width={420} height={50} />
          </Card>
        </div>

        <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-sm btn-danger">Hapus Profile</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose}>Batal</button>
            <button className="btn btn-primary btn-sm"><Icon.Check size={13} />Simpan</button>
          </div>
        </div>
      </div>
    </>
  );
}

window.HotspotProfilesScreen = HotspotProfilesScreen;
