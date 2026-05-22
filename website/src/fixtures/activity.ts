export type ActivityType = 'login' | 'sale' | 'kick' | 'expiry'

export interface FixtureActivity {
  type: ActivityType
  user: string
  detail: string
  t: number // seconds ago
}

export const ACTIVITY: FixtureActivity[] = [
  { type: 'login', user: 'lulu108', detail: 'login dari 10.5.50.21', t: 3 },
  { type: 'sale', user: 'voucher-h7k2nq', detail: 'Voucher 1HARI-10K terjual', t: 42 },
  { type: 'kick', user: 'tio215', detail: 'di-kick oleh admin (manual)', t: 120 },
  { type: 'login', user: 'bagas088', detail: 'login dari 10.5.51.5', t: 215 },
  { type: 'expiry', user: 'rifqi142', detail: 'expired (auto-disable)', t: 360 },
  { type: 'sale', user: 'batch #B-241', detail: '25× voucher 6HR-5K generated', t: 540 },
  { type: 'login', user: 'maya070', detail: 'login dari 10.5.50.49', t: 700 },
  { type: 'kick', user: 'sari011', detail: 'session ended (timeout)', t: 980 },
  { type: 'sale', user: 'voucher-q12pma', detail: 'Voucher 1HR-3K terjual', t: 1340 },
]

export const REVENUE_7D = {
  labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
  voucher: [285000, 312000, 268000, 401000, 478000, 612000, 540000],
  transaksi: [43, 48, 39, 56, 67, 84, 71],
}

export const TRAFFIC_24H = {
  labels: ['00', '03', '06', '09', '12', '15', '18', '21'],
  rx: [12, 8, 15, 28, 45, 38, 62, 52],
  tx: [4, 3, 6, 10, 18, 14, 24, 21],
}
