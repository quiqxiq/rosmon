// data.jsx — mock data for the prototype.
// Resembles roslib-mikhmon REST payloads loosely (hotspot users, sessions,
// vouchers, profiles, devices, transactions).

const DEVICES = [
  { id: 'rb-main',     name: 'Mikrotik HAP ac²',    slug: 'rb-main',     address: '192.168.88.1',   status: 'online',  uptime: '23d 14h', users: 412, active: 187, version: 'RouterOS 7.16.2' },
  { id: 'rb-cabang-2', name: 'Mikrotik RB951Ui',    slug: 'rb-cabang-2', address: '192.168.10.1',   status: 'online',  uptime: '7d 02h',  users: 128, active:  54, version: 'RouterOS 7.15.3' },
  { id: 'rb-warnet',   name: 'Mikrotik hEX S',      slug: 'rb-warnet',   address: '10.10.0.1',      status: 'warn',    uptime: '1d 04h',  users:  86, active:  19, version: 'RouterOS 7.14.1' },
  { id: 'rb-kost',     name: 'Mikrotik RB750Gr3',   slug: 'rb-kost',     address: '192.168.5.1',    status: 'offline', uptime: '—',        users:  64, active:   0, version: 'RouterOS 7.13.0' },
];

const PROFILES = [
  { name: '1HR-3K',     price: 3000,   validity: '1h',  speed: '5M/2M',  sold: 412, color: 'cyan' },
  { name: '6HR-5K',     price: 5000,   validity: '6h',  speed: '5M/2M',  sold: 318, color: 'cyan' },
  { name: '1HARI-10K',  price: 10000,  validity: '1d',  speed: '10M/3M', sold: 506, color: 'violet' },
  { name: '7HARI-50K',  price: 50000,  validity: '7d',  speed: '10M/5M', sold: 122, color: 'violet' },
  { name: '30HARI-150K',price: 150000, validity: '30d', speed: '15M/8M', sold:  47, color: 'lime' },
];

const FIRST_NAMES = ['Adi','Budi','Citra','Dewi','Eko','Fajar','Gita','Hadi','Indra','Joko','Kiki','Lia','Maya','Nina','Oscar','Putri','Qila','Rini','Sari','Tono','Uli','Vina','Wahyu','Yuni','Zaki','Bayu','Rifqi','Tio','Bagas','Lulu'];

function rid(len=6) {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s=''; for (let i=0;i<len;i++) s+=c[Math.floor(Math.random()*c.length)]; return s;
}
function vid() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for (let i=0;i<8;i++) s+=c[Math.floor(Math.random()*c.length)]; return s;
}
function macRand() {
  const h = () => Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase();
  return `${h()}:${h()}:${h()}:${h()}:${h()}:${h()}`;
}
function ipFromSeed(i) { return `10.5.${Math.floor(i/250)+50}.${(i%250)+2}`; }

// hotspot users (CRUD)
const HS_USERS = (() => {
  const arr = [];
  for (let i = 0; i < 64; i++) {
    const p = PROFILES[i % PROFILES.length];
    const dev = i % 17 === 0 ? false : true;
    const active = i % 5 < 3;
    const name = (i % 11 === 0)
      ? `voucher-${vid().toLowerCase()}`
      : `${FIRST_NAMES[i%FIRST_NAMES.length].toLowerCase()}${(100+i).toString()}`;
    arr.push({
      id: `*${(0x10 + i).toString(16).toUpperCase()}`,
      name,
      profile: p.name,
      server: i % 4 === 0 ? 'hotspot1' : 'hotspot2',
      uptime: Math.floor(Math.random() * 86400 * 3),
      bytesIn: Math.floor(Math.random() * 6e9),
      bytesOut: Math.floor(Math.random() * 1.5e9),
      mac: i % 3 === 0 ? macRand() : null,
      expiry: Date.now() + (Math.random() * 6 - 2) * 86400000,
      comment: i % 7 === 0 ? `vc-${new Date().toISOString().slice(0,10)}` : '',
      disabled: !active && i % 3 === 0,
      isActive: active,
    });
  }
  return arr;
})();

// live hotspot active sessions
const HS_ACTIVE = (() => {
  const arr = [];
  for (let i = 0; i < 12; i++) {
    const u = HS_USERS[i];
    arr.push({
      id: `*A${i.toString(16).toUpperCase()}`,
      user: u.name,
      profile: u.profile,
      server: u.server,
      address: ipFromSeed(i),
      mac: u.mac || macRand(),
      loginBy: 'cookie',
      uptimeStart: Date.now() - (Math.random() * 4 + 0.1) * 3600 * 1000,
      bytesIn: Math.floor(Math.random() * 2e9),
      bytesOut: Math.floor(Math.random() * 6e8),
      rxRate: 200000 + Math.floor(Math.random() * 5_000_000),
      txRate:  50000 + Math.floor(Math.random() * 1_500_000),
      sparkIn: Array.from({length:18}, () => Math.random()),
    });
  }
  return arr;
})();

// recent activity feed (mixed events)
const ACTIVITY = [
  { type: 'login', user: 'lulu108', detail: 'login dari 10.5.50.21', t: 3 },
  { type: 'sale',  user: 'voucher-h7k2nq', detail: 'Voucher 1HARI-10K terjual', t: 42 },
  { type: 'kick',  user: 'tio215',  detail: 'di-kick oleh admin (manual)', t: 120 },
  { type: 'login', user: 'bagas088',detail: 'login dari 10.5.51.5', t: 215 },
  { type: 'expiry',user: 'rifqi142',detail: 'expired (auto-disable)', t: 360 },
  { type: 'sale',  user: 'batch #B-241', detail: '25× voucher 6HR-5K generated', t: 540 },
  { type: 'login', user: 'maya070', detail: 'login dari 10.5.50.49', t: 700 },
  { type: 'kick',  user: 'sari011', detail: 'session ended (timeout)', t: 980 },
  { type: 'sale',  user: 'voucher-q12pma', detail: 'Voucher 1HR-3K terjual', t: 1340 },
];

// 7-day revenue
const REVENUE_7D = {
  labels: ['Sen','Sel','Rab','Kam','Jum','Sab','Min'],
  voucher:    [285000, 312000, 268000, 401000, 478000, 612000, 540000],
  transaksi:  [ 43, 48, 39, 56, 67, 84, 71 ],
};

// 24h traffic (Mbps)
const TRAFFIC_24H = {
  labels: ['00','03','06','09','12','15','18','21'],
  rx: [12, 8, 15, 28, 45, 38, 62, 52],
  tx: [ 4, 3,  6, 10, 18, 14, 24, 21],
};

// PPP secrets
const PPP_SECRETS = (() => {
  const arr = [];
  const profs = ['10M-PPPoE','20M-PPPoE','50M-PPPoE','100M-PPPoE','5M-Limit'];
  for (let i = 0; i < 18; i++) {
    const active = i % 3 !== 2;
    arr.push({
      id: `*P${(0x10 + i).toString(16).toUpperCase()}`,
      name: `pppoe-${['rt','warnet','kantor','rumah','kios'][i%5]}-${(i+10).toString().padStart(2,'0')}`,
      password: '••••••••',
      profile: profs[i % profs.length],
      service: 'pppoe',
      address: `10.20.${1 + Math.floor(i/8)}.${(i%8) + 2}`,
      callerId: i % 4 === 0 ? `AA:BB:CC:${(0x10+i).toString(16).toUpperCase()}:00:01` : '',
      comment: i % 5 === 0 ? `Pelanggan #${1000+i}` : '',
      lastLoggedOut: Date.now() - (Math.random() * 86400000 * 7),
      isActive: active,
      disabled: i % 11 === 0,
    });
  }
  return arr;
})();

const PPP_PROFILES = [
  { id: '*P1', name: '5M-Limit',     rateLimit: '5M/2M',     localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-5m',  parentQueue: 'all-ppp', sessions: 24, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P2', name: '10M-PPPoE',    rateLimit: '10M/3M',    localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-10m', parentQueue: 'all-ppp', sessions: 32, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P3', name: '20M-PPPoE',    rateLimit: '20M/5M',    localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-20m', parentQueue: 'all-ppp', sessions: 18, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P4', name: '50M-PPPoE',    rateLimit: '50M/10M',   localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-50m', parentQueue: 'all-ppp', sessions:  9, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P5', name: '100M-PPPoE',   rateLimit: '100M/20M',  localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-100m', parentQueue: 'all-ppp', sessions:  3, dnsServer: '8.8.8.8,1.1.1.1' },
];

const PPP_ACTIVE = PPP_SECRETS.filter(s => s.isActive).slice(0, 8).map((s,i) => ({
  ...s,
  uptimeStart: Date.now() - (Math.random() * 86400000 * 3),
  rxRate: 200_000 + Math.floor(Math.random() * 50_000_000),
  txRate:  80_000 + Math.floor(Math.random() * 15_000_000),
  bytesIn:  Math.floor(Math.random() * 8e9),
  bytesOut: Math.floor(Math.random() * 2e9),
  callerId: s.callerId || `AA:BB:CC:${(0x20+i).toString(16).toUpperCase()}:11:22`,
  encoding: 'mppe128',
}));

// Network — interfaces
const INTERFACES = [
  { id: '*1', name: 'ether1',  type: 'ether',   running: true,  disabled: false, comment: 'WAN',         macAddress: '74:4D:28:11:22:01', mtu: 1500, rxRate: 62_400_000, txRate: 24_100_000, rxBytes: 1.2e12, txBytes: 4.8e11, link: '1Gbps Full' },
  { id: '*2', name: 'ether2',  type: 'ether',   running: true,  disabled: false, comment: 'LAN',         macAddress: '74:4D:28:11:22:02', mtu: 1500, rxRate: 12_800_000, txRate: 38_400_000, rxBytes: 6.4e11, txBytes: 1.8e12, link: '1Gbps Full' },
  { id: '*3', name: 'ether3',  type: 'ether',   running: false, disabled: false, comment: '',            macAddress: '74:4D:28:11:22:03', mtu: 1500, rxRate: 0,          txRate: 0,          rxBytes: 0,    txBytes: 0,    link: 'no-link' },
  { id: '*4', name: 'wlan1',   type: 'wlan',    running: true,  disabled: false, comment: 'Hotspot-2G',  macAddress: '74:4D:28:11:22:04', mtu: 1500, rxRate:  4_800_000, txRate: 18_200_000, rxBytes: 2.4e11, txBytes: 9.1e11, link: '2.4GHz n' },
  { id: '*5', name: 'wlan2',   type: 'wlan',    running: true,  disabled: false, comment: 'Hotspot-5G',  macAddress: '74:4D:28:11:22:05', mtu: 1500, rxRate: 21_400_000, txRate: 84_800_000, rxBytes: 1.1e12, txBytes: 4.2e12, link: '5GHz ac' },
  { id: '*6', name: 'bridge1', type: 'bridge',  running: true,  disabled: false, comment: 'br-hotspot',  macAddress: '74:4D:28:11:22:00', mtu: 1500, rxRate: 28_200_000, txRate: 102_000_000, rxBytes: 1.3e12, txBytes: 5.1e12, link: '—' },
  { id: '*7', name: 'pppoe-out1', type: 'pppoe-out', running: true, disabled: false, comment: 'WAN PPPoE', macAddress: '00:00:00:00:00:00', mtu: 1480, rxRate: 0, txRate: 0, rxBytes: 0, txBytes: 0, link: 'connected' },
];

const IP_POOLS = [
  { id: '*P1', name: 'pool-hotspot',    ranges: '10.5.50.2-10.5.55.254',  next: 'pool-hotspot', used: 187, total: 1276 },
  { id: '*P2', name: 'pool-pppoe-10m',  ranges: '10.20.10.2-10.20.10.254', next: '',          used:  32, total:  253 },
  { id: '*P3', name: 'pool-pppoe-20m',  ranges: '10.20.20.2-10.20.20.254', next: '',          used:  18, total:  253 },
  { id: '*P4', name: 'pool-pppoe-50m',  ranges: '10.20.50.2-10.20.50.254', next: '',          used:   9, total:  253 },
];

const ARP = (() => {
  const arr = [];
  for (let i = 0; i < 24; i++) {
    arr.push({
      id: `*A${i.toString(16).toUpperCase()}`,
      address: `10.5.${50 + Math.floor(i/10)}.${(i%10)+2}`,
      macAddress: macRand(),
      interface: i % 3 === 0 ? 'wlan1' : i % 3 === 1 ? 'wlan2' : 'ether2',
      dynamic: i % 7 !== 0,
      complete: true,
      published: false,
    });
  }
  return arr;
})();

const DHCP_LEASES = ARP.slice(0, 12).map((a, i) => ({
  ...a,
  hostName: `device-${['phone','laptop','desktop','tablet','iot'][i%5]}-${100+i}`,
  expiresAfter: Math.floor(Math.random() * 86400 * 3),
  status: i % 5 === 4 ? 'waiting' : 'bound',
}));

const QUEUES = (() => {
  const arr = [];
  for (let i = 0; i < 10; i++) {
    const cap = [5, 10, 20, 50][i%4] * 1_000_000;
    arr.push({
      id: `*Q${i.toString(16).toUpperCase()}`,
      name: `user-${FIRST_NAMES[i].toLowerCase()}${100+i}`,
      target: `10.5.50.${i+2}/32`,
      maxLimit: `${cap/1_000_000}M/${cap/2_000_000}M`,
      maxLimitBps: cap,
      curRx: Math.floor(Math.random() * cap),
      curTx: Math.floor(Math.random() * cap * 0.4),
      disabled: i % 9 === 0,
    });
  }
  return arr;
})();

// Reports — transactions (sales)
const TRANSACTIONS = (() => {
  const arr = [];
  const profiles = PROFILES;
  const sources = ['voucher-gen', 'manual', 'pos-app'];
  const operators = ['rendra','aulia','dewa','mira'];
  for (let i = 0; i < 36; i++) {
    const p = profiles[Math.floor(Math.random()*profiles.length)];
    const daysAgo = Math.floor(i / 5);
    const date = new Date(Date.now() - daysAgo * 86400000 - Math.random()*86400000);
    arr.push({
      id: `T${(1000+i)}`,
      date: date.toISOString(),
      user: `voucher-${vid().toLowerCase()}`,
      profile: p.name,
      price: p.price,
      source: sources[i % sources.length],
      operator: operators[i % operators.length],
    });
  }
  return arr.sort((a,b) => new Date(b.date) - new Date(a.date));
})();

// 30-day revenue
const REVENUE_30D = {
  labels: Array.from({length: 30}, (_,i) => `${i+1}`),
  values: Array.from({length: 30}, (_,i) => 200_000 + Math.floor(Math.random() * 700_000) + (i > 25 ? 250_000 : 0)),
};

// System — scripts + schedulers + logs
const SCRIPTS = [
  { id: '*S1', name: 'on-login-hotspot',     owner: 'admin', policy: 'read,write,test', lastStarted: Date.now() - 30000,    runCount: 1284, source: '/log info "hotspot login"' },
  { id: '*S2', name: 'expire-voucher-batch', owner: 'admin', policy: 'read,write,policy', lastStarted: Date.now() - 3600000, runCount:  486, source: ':foreach u in=[/ip hotspot user find]' },
  { id: '*S3', name: 'backup-daily',         owner: 'admin', policy: 'read,write,policy,ftp', lastStarted: Date.now() - 86400000, runCount:  98, source: '/system backup save name=daily' },
  { id: '*S4', name: 'reset-counter-monthly',owner: 'admin', policy: 'read,write',         lastStarted: Date.now() - 2592000000, runCount:  12, source: ':foreach q in=[/queue simple find]' },
];

const SCHEDULERS = [
  { id: '*K1', name: 'sch-expire',  startDate: '2025-01-01', startTime: '00:05:00', interval: '5m',  onEvent: 'expire-voucher-batch', runCount: 12480, nextRun: Date.now() + 240000,   disabled: false },
  { id: '*K2', name: 'sch-backup',  startDate: '2025-01-01', startTime: '02:00:00', interval: '1d',  onEvent: 'backup-daily',         runCount:   145, nextRun: Date.now() + 7200000,  disabled: false },
  { id: '*K3', name: 'sch-monthly', startDate: '2025-01-01', startTime: '00:00:00', interval: '30d', onEvent: 'reset-counter-monthly',runCount:    12, nextRun: Date.now() + 1209600000, disabled: false },
  { id: '*K4', name: 'sch-noop',    startDate: '2025-03-01', startTime: '03:00:00', interval: '1d',  onEvent: 'cleanup-temp',          runCount:    24, nextRun: 0, disabled: true },
];

const LOGS = (() => {
  const topics = ['hotspot,info','hotspot,account,info','system,info','system,warning','interface,info','firewall,warning','dhcp,info','wireless,info'];
  const samples = [
    'logged in', 'logged out: idle-timeout', 'login from cookie', 'login failed',
    'lease bound', 'lease ended', 'link up', 'link down',
    'CPU usage above 80%', 'config changed by admin', 'voucher batch generated',
  ];
  return Array.from({length: 40}, (_,i) => ({
    id: i,
    time: new Date(Date.now() - i * 60000 * Math.random() * 10).toISOString().slice(11,19),
    topics: topics[i % topics.length],
    message: `${samples[i % samples.length]}${i%4===0 ? ` (user=${FIRST_NAMES[i%FIRST_NAMES.length].toLowerCase()}${100+i})` : ''}`,
  }));
})();

// nav items
const NAV = [
  { id: 'overview',  label: 'Overview',           icon: 'Home',     primary: true },
  { id: 'users',     label: 'Hotspot Users',      icon: 'Users',    primary: true, badge: '64' },
  { id: 'voucher',   label: 'Voucher Generator',  icon: 'Ticket',   primary: true },
  { id: 'sessions',  label: 'Live Sessions',      icon: 'Activity', primary: true, live: true },
  { id: 'profiles',  label: 'Hotspot Profiles',   icon: 'Wifi' },
  { id: 'ppp',       label: 'PPP',                icon: 'Link2',    badge: '12' },
  { id: 'network',   label: 'Network',            icon: 'Network' },
  { id: 'reports',   label: 'Laporan',            icon: 'Report' },
  { id: 'system',    label: 'System',             icon: 'Server' },
];

Object.assign(window, {
  DEVICES, PROFILES, HS_USERS, HS_ACTIVE, ACTIVITY,
  REVENUE_7D, TRAFFIC_24H, NAV,
  PPP_SECRETS, PPP_PROFILES, PPP_ACTIVE,
  INTERFACES, IP_POOLS, ARP, DHCP_LEASES, QUEUES,
  TRANSACTIONS, REVENUE_30D,
  SCRIPTS, SCHEDULERS, LOGS,
  rid, vid, macRand, ipFromSeed,
});
