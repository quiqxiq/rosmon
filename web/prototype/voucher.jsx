// voucher.jsx — Voucher generator screen.

function VoucherScreen({ device }) {
  const [form, setForm] = React.useState({
    quantity: 25,
    profile: PROFILES[1].name,
    server: 'hotspot1',
    nameMode: 'random',   // 'random' | 'voucher-prefix' | 'sequential'
    passwordMode: 'same', // 'same' | 'random' | 'fixed'
    prefix: '',
    length: 6,
    charset: 'alnum-upper', // 'alnum-upper' | 'alnum' | 'numeric' | 'letters'
    validity: PROFILES[1].validity,
    comment: `vc-${new Date().toISOString().slice(0,10)}`,
    sellPrice: PROFILES[1].price,
  });
  const [vouchers, setVouchers] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [printSize, setPrintSize] = React.useState('mini');
  const [copied, setCopied] = React.useState(null);

  const upd = (k,v) => setForm(f => ({...f, [k]:v}));
  const upd2 = (obj) => setForm(f => ({...f, ...obj}));

  const profile = PROFILES.find(p => p.name === form.profile);
  React.useEffect(() => {
    upd2({ validity: profile.validity, sellPrice: profile.price });
  }, [form.profile]);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      const arr = [];
      const charsets = {
        'alnum-upper': 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
        'alnum': 'abcdefghijkmnpqrstuvwxyz23456789',
        'numeric': '0123456789',
        'letters': 'ABCDEFGHJKMNPQRSTUVWXYZ',
      };
      const cs = charsets[form.charset];
      for (let i = 0; i < form.quantity; i++) {
        let code = '';
        for (let j = 0; j < form.length; j++) code += cs[Math.floor(Math.random()*cs.length)];
        const name = form.prefix ? form.prefix + code : code;
        const password = form.passwordMode === 'same' ? name
                       : form.passwordMode === 'fixed' ? '1234'
                       : (() => { let p=''; for (let j=0;j<form.length;j++) p+=cs[Math.floor(Math.random()*cs.length)]; return p; })();
        arr.push({ id: i, name, password });
      }
      setVouchers(arr);
      setGenerating(false);
    }, 600);
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Voucher Generator"
        subtitle={<>Generate batch voucher hotspot baru untuk <b style={{ color: 'var(--text-2)', fontWeight:500 }}>{device}</b></>}
        right={vouchers && (
          <>
            <button className="btn btn-sm" onClick={()=>setVouchers(null)}>
              <Icon.Plus size={13}/>Batch Baru
            </button>
          </>
        )}
      />

      {!vouchers && (
        <div style={{ display:'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 'var(--gap-grid)' }}>
          {/* Form */}
          <Card>
            <FormSection title="Quantity & Profile" step={1}>
              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Jumlah voucher" required>
                  <div style={{ display:'flex', gap: 6 }}>
                    <input className="input mono" type="number" value={form.quantity} onChange={e=>upd('quantity', Math.max(1, Math.min(500, parseInt(e.target.value)||1)))} style={{ flex: 1 }} />
                    <div className="seg" style={{ flexShrink: 0 }}>
                      {[10, 25, 50, 100].map(n => (
                        <button key={n} className={form.quantity===n?'on':''} onClick={()=>upd('quantity', n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                </Field>
                <Field label="Server">
                  <select className="input select" value={form.server} onChange={e=>upd('server', e.target.value)}>
                    <option value="hotspot1">hotspot1</option>
                    <option value="hotspot2">hotspot2</option>
                    <option value="all">all</option>
                  </select>
                </Field>
              </div>

              <Field label="Profile" hint={`${profile.speed} · validity ${profile.validity}`}>
                <div style={{ display:'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {PROFILES.map(p => (
                    <ProfilePill key={p.name} profile={p} selected={p.name === form.profile} onClick={()=>upd('profile', p.name)} />
                  ))}
                </div>
              </Field>

              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Harga jual" hint="Disimpan di transaksi report">
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left: 12, top: '50%', transform:'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }}>Rp</span>
                    <input className="input mono tabular" type="number" value={form.sellPrice} onChange={e=>upd('sellPrice', parseInt(e.target.value)||0)} style={{ paddingLeft: 32, textAlign:'right' }} />
                  </div>
                </Field>
                <Field label="Validity" hint="Sejak login pertama">
                  <select className="input select" value={form.validity} onChange={e=>upd('validity', e.target.value)}>
                    <option value="1h">1 Jam</option>
                    <option value="3h">3 Jam</option>
                    <option value="6h">6 Jam</option>
                    <option value="12h">12 Jam</option>
                    <option value="1d">1 Hari</option>
                    <option value="7d">7 Hari</option>
                    <option value="30d">30 Hari</option>
                  </select>
                </Field>
              </div>
            </FormSection>

            <FormSection title="Format Username & Password" step={2}>
              <Field label="Mode Username">
                <Segmented value={form.nameMode} onChange={v=>upd('nameMode', v)}
                  options={[{value:'random',label:'Random'},{value:'voucher-prefix',label:'Prefix + Random'},{value:'sequential',label:'Sequential'}]} />
              </Field>

              {form.nameMode === 'voucher-prefix' && (
                <Field label="Prefix">
                  <input className="input mono" value={form.prefix} onChange={e=>upd('prefix', e.target.value)} placeholder="vc-" />
                </Field>
              )}

              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Panjang karakter">
                  <input className="input mono" type="range" min="4" max="12" value={form.length} onChange={e=>upd('length', parseInt(e.target.value))} />
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop: 4, fontSize: 11, color: 'var(--muted)' }} className="mono">
                    <span>4</span><span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{form.length} karakter</span><span>12</span>
                  </div>
                </Field>
                <Field label="Charset">
                  <select className="input select" value={form.charset} onChange={e=>upd('charset', e.target.value)}>
                    <option value="alnum-upper">Huruf besar + angka (kecuali O, 0, I, 1)</option>
                    <option value="alnum">Huruf kecil + angka</option>
                    <option value="numeric">Hanya angka</option>
                    <option value="letters">Hanya huruf</option>
                  </select>
                </Field>
              </div>

              <Field label="Password">
                <Segmented value={form.passwordMode} onChange={v=>upd('passwordMode', v)}
                  options={[{value:'same',label:'Sama dengan user'},{value:'random',label:'Acak'},{value:'fixed',label:'Tetap (1234)'}]} />
              </Field>
            </FormSection>

            <FormSection title="Komentar (untuk pelacakan)" step={3}>
              <Field label="Komentar" hint="Akan disimpan di field comment user">
                <input className="input mono" value={form.comment} onChange={e=>upd('comment', e.target.value)} placeholder={`vc-${new Date().toISOString().slice(0,10)}`} />
              </Field>
            </FormSection>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 6, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total estimasi pendapatan</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>
                  {fmt.rp(form.quantity * form.sellPrice)}
                </div>
              </div>
              <button className="btn btn-violet" style={{ height: 42, padding: '0 22px', fontSize: 14 }} onClick={generate} disabled={generating}>
                {generating ? (
                  <><span className="spinner" style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', display:'inline-block', animation:'spin 0.6s linear infinite' }} /> Membuat...</>
                ) : (
                  <><Icon.Sparkles size={16} /> Generate {form.quantity} Voucher</>
                )}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </Card>

          {/* Preview */}
          <div style={{ display:'flex', flexDirection:'column', gap: 'var(--gap-grid)' }}>
            <Card>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500 }}>Preview Voucher</div>
                <Badge tone="cyan">Live</Badge>
              </div>
              <VoucherCardPreview profile={profile} form={form} bigName="A7K2NQ" />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
                Voucher akan dicetak sesuai template ini. Anda bisa ubah template setelah generate.
              </div>
            </Card>

            <Card style={{ background: 'linear-gradient(135deg, var(--accent-violet-soft), transparent)', border: '1px solid var(--border)' }}>
              <div style={{ display:'flex', gap: 12 }}>
                <Icon.Sparkles size={20} color="var(--accent-violet)" style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Tips Generator</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                    <li>• Charset <b>"upper + angka"</b> menghindari kebingungan O/0 dan I/1 saat dicetak.</li>
                    <li>• Mode <b>"sama dengan user"</b> mempercepat distribusi (1 kode = login).</li>
                    <li>• Komentar berformat <span className="mono">vc-YYYY-MM-DD</span> memudahkan filter batch.</li>
                    <li>• Endpoint: <span className="mono" style={{ color: 'var(--accent-cyan)' }}>POST /devices/{'{id}'}/hotspot/vouchers/generate</span></li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 500, marginBottom: 12 }}>Batch terakhir</div>
              {[
                { date: 'Hari ini, 09:42', qty: 25, profile: '1HR-3K', revenue: 75000, by: 'rendra' },
                { date: 'Hari ini, 07:15', qty: 50, profile: '1HARI-10K', revenue: 500000, by: 'rendra' },
                { date: 'Kemarin, 21:08', qty: 10, profile: '7HARI-50K', revenue: 500000, by: 'aulia' },
              ].map((b, i) => (
                <div key={i} className="row-hover" style={{ display:'flex', alignItems:'center', gap: 12, padding: '10px 4px', borderBottom: i<2 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'var(--accent-cyan-soft)', color: 'var(--accent-cyan)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Icon.Ticket size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.qty}× {b.profile}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.date} · oleh {b.by}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }} className="mono tabular">{fmt.rpShort(b.revenue)}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {vouchers && (
        <VoucherResults vouchers={vouchers} form={form} profile={profile} printSize={printSize} setPrintSize={setPrintSize} copied={copied} setCopied={setCopied} />
      )}
    </div>
  );
}

function FormSection({ title, step, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 14 }}>
        {step && (
          <span style={{
            width: 24, height: 24, borderRadius: 7, background: 'var(--accent-cyan-soft)',
            color: 'var(--accent-cyan)', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: 12, fontWeight: 600, fontVariantNumeric:'tabular-nums',
          }}>{step}</span>
        )}
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 14, paddingLeft: step ? 34 : 0 }}>
        {children}
      </div>
    </div>
  );
}

function ProfilePill({ profile, selected, onClick }) {
  const color = profile.color === 'cyan' ? 'var(--accent-cyan)' : profile.color === 'violet' ? 'var(--accent-violet)' : 'var(--accent-lime)';
  const bg = profile.color === 'cyan' ? 'var(--accent-cyan-soft)' : profile.color === 'violet' ? 'var(--accent-violet-soft)' : 'var(--accent-lime-soft)';
  return (
    <button
      onClick={onClick}
      style={{
        appearance:'none', cursor:'pointer',
        padding: '10px 8px',
        border: selected ? `2px solid ${color}` : '1px solid var(--border-strong)',
        background: selected ? bg : 'var(--bg-2)',
        borderRadius: 10,
        display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
        transition: 'all 140ms',
        fontFamily: 'inherit',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? color : 'var(--text-2)' }}>{profile.name}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">{fmt.rpShort(profile.price)}</div>
    </button>
  );
}

function VoucherCardPreview({ profile, form, bigName }) {
  return (
    <div className="voucher" style={{ background: 'var(--bg-2)', padding: '18px 22px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <Icon.Wifi size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing:'0.06em' }}>HOTSPOT WIFI</span>
        </div>
        <Badge tone={profile.color}>{profile.name}</Badge>
      </div>
      <div style={{ borderTop: '1px dashed var(--border-strong)', margin: '8px 0' }} />
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Kode Voucher</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.1em', marginTop: 6, color: 'var(--accent-cyan)', textShadow: '0 0 16px var(--accent-cyan-soft)' }} className="mono">
          {form.prefix}{bigName}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }} className="mono">
          password: <span style={{ color:'var(--text-2)' }}>{form.passwordMode === 'fixed' ? '1234' : form.passwordMode === 'same' ? (form.prefix + bigName) : 'XYZ123'}</span>
        </div>
      </div>
      <div style={{ borderTop: '1px dashed var(--border-strong)', margin: '14px 0 10px' }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
        <div>Durasi: <span style={{ color: 'var(--text-2)' }} className="mono">{profile.validity}</span></div>
        <div style={{ textAlign:'right' }}>Speed: <span style={{ color: 'var(--text-2)' }} className="mono">{profile.speed}</span></div>
        <div>Harga: <span style={{ color: 'var(--text-2)' }} className="mono">{fmt.rpShort(form.sellPrice)}</span></div>
        <div style={{ textAlign:'right' }} className="mono">{new Date().toLocaleDateString('id-ID')}</div>
      </div>
    </div>
  );
}

function VoucherResults({ vouchers, form, profile, printSize, setPrintSize, copied, setCopied }) {
  const copyAll = () => {
    setCopied('all');
    setTimeout(()=>setCopied(null), 1500);
  };
  return (
    <div className="scale-in">
      {/* Success banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(163,230,53,0.12), rgba(34,211,238,0.08))',
        border: '1px solid rgba(163,230,53,0.3)',
        borderRadius: 14, padding: 18,
        display: 'flex', alignItems:'center', gap: 14,
        marginBottom: 'var(--gap-grid)',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-lime)', display:'flex', alignItems:'center', justifyContent:'center', color: '#0D1F00' }}>
          <Icon.Check size={22} strokeWidth={3} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Berhasil membuat {vouchers.length} voucher</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            Profile <b style={{ color: 'var(--text-2)' }}>{profile.name}</b> · Estimasi pendapatan <b style={{ color: 'var(--accent-lime)' }}>{fmt.rp(vouchers.length * form.sellPrice)}</b> · Komentar <span className="mono" style={{ color: 'var(--text-2)' }}>{form.comment}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={copyAll}>
            <Icon.Copy size={13} /> {copied === 'all' ? 'Tersalin!' : 'Copy semua'}
          </button>
          <button className="btn btn-sm"><Icon.Download size={13} />CSV</button>
          <button className="btn btn-primary btn-sm"><Icon.Print size={13} />Cetak</button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Tampilan</span>
          <Segmented value={printSize} onChange={setPrintSize}
            options={[{value:'mini',label:'Mini'},{value:'standard',label:'Standar'},{value:'list',label:'List'}]} />
        </div>
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{vouchers.length} voucher</span>
        </div>
      </div>

      {/* Voucher grid */}
      {printSize !== 'list' && (
        <div style={{
          display:'grid',
          gridTemplateColumns: printSize === 'mini' ? 'repeat(auto-fill, minmax(180px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {vouchers.map((v, i) => (
            <div key={v.id} className="voucher fade-in" style={{ animationDelay: `${Math.min(i*20, 600)}ms`, padding: printSize === 'mini' ? '12px 16px' : '16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing:'0.08em', color: 'var(--muted)' }}>HOTSPOT</span>
                <Badge tone={profile.color}>{profile.validity}</Badge>
              </div>
              <div style={{ textAlign:'center', padding: '4px 0' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Kode</div>
                <div className="mono" style={{ fontSize: printSize === 'mini' ? 17 : 22, fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.08em', marginTop: 3 }}>
                  {v.name}
                </div>
                {form.passwordMode !== 'same' && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }} className="mono">
                    pwd: {v.password}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', borderTop: '1px dashed var(--border-strong)', paddingTop: 6, marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
                <span className="mono">{profile.speed}</span>
                <span className="mono">{fmt.rpShort(form.sellPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {printSize === 'list' && (
        <Card style={{ padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>#</th><th>Username</th><th>Password</th><th>Profile</th><th>Validity</th><th>Harga</th><th>Aksi</th></tr></thead>
            <tbody>
              {vouchers.map((v, i) => (
                <tr key={v.id}>
                  <td className="mono" style={{ color:'var(--muted)' }}>{i+1}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{v.name}</td>
                  <td className="mono">{v.password}</td>
                  <td><Badge tone={profile.color}>{profile.name}</Badge></td>
                  <td className="mono">{profile.validity}</td>
                  <td className="mono tabular">{fmt.rpShort(form.sellPrice)}</td>
                  <td><button className="btn btn-ghost btn-xs"><Icon.Copy size={11}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

window.VoucherScreen = VoucherScreen;
