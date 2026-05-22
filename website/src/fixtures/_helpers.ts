export const FIRST_NAMES = [
  'Adi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indra', 'Joko',
  'Kiki', 'Lia', 'Maya', 'Nina', 'Oscar', 'Putri', 'Qila', 'Rini', 'Sari', 'Tono',
  'Uli', 'Vina', 'Wahyu', 'Yuni', 'Zaki', 'Bayu', 'Rifqi', 'Tio', 'Bagas', 'Lulu',
]

// Deterministic-ish: seeded random for fixture stability across reloads
let seed = 42
function rng() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

export function rid(len = 6): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += c[Math.floor(rng() * c.length)]
  return s
}

export function vid(): string {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += c[Math.floor(rng() * c.length)]
  return s
}

export function macRand(): string {
  const h = () =>
    Math.floor(rng() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `${h()}:${h()}:${h()}:${h()}:${h()}:${h()}`
}

export function ipFromSeed(i: number): string {
  return `10.5.${Math.floor(i / 250) + 50}.${(i % 250) + 2}`
}

export function rand(min: number, max: number): number {
  return min + rng() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}
