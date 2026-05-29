import { hotspotProfilesSeed } from '@/features/hotspot/profiles/data/data'
import {
  type CharSet,
  type DataLimitUnit,
  type GeneratedVoucher,
  type UserType,
  type VoucherGenerateForm,
} from './schema'

export const userTypeOptions: Array<{ label: string; value: UserType }> = [
  { label: 'User & Password', value: 'up' },
  { label: 'Username Only (Voucher)', value: 'vc' },
]

export const charSetOptions: Array<{ label: string; value: CharSet }> = [
  { label: 'Lower (abcd)', value: 'lower' },
  { label: 'Upper (ABCD)', value: 'upper' },
  { label: 'Upper + Lower (aBcD)', value: 'upplow' },
  { label: 'Number + Lower (5ab2c)', value: 'mix' },
  { label: 'Number + Upper (5AB2C)', value: 'mix1' },
  { label: 'Number + Upper + Lower (5aB2C)', value: 'mix2' },
  { label: 'Number Only (1234)', value: 'num' },
]

export const nameLengthOptions = [3, 4, 5, 6, 7, 8].map((n) => ({
  label: String(n),
  value: n,
}))

export const dataLimitUnitOptions: Array<{
  label: string
  value: DataLimitUnit
}> = [
  { label: 'MB', value: 'MB' },
  { label: 'GB', value: 'GB' },
]

export const serverGenerateOptions = [
  { label: 'all', value: 'all' },
  { label: 'HS-01', value: 'HS-01' },
  { label: 'HS-02', value: 'HS-02' },
  { label: 'HS-03', value: 'HS-03' },
]

export const profileGenerateOptions = hotspotProfilesSeed.map((p) => ({
  label: p.name,
  value: p.name,
  price: p.price,
  sellingPrice: p.sellingPrice,
  validity: p.validity,
}))

export const defaultGenerateForm: VoucherGenerateForm = {
  qty: 1,
  server: 'all',
  profile: hotspotProfilesSeed[0]?.name ?? '',
  userType: 'up',
  nameLength: 6,
  charSet: 'mix',
  prefix: '',
  timeLimit: '0',
  dataLimit: 0,
  dataLimitUnit: 'MB',
  comment: '',
}

const CHARSETS: Record<CharSet, string> = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  upplow: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  mix: '0123456789abcdefghijklmnopqrstuvwxyz',
  mix1: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  mix2: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  num: '0123456789',
}

function randomString(charset: string, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(Math.random() * charset.length)]
  }
  return out
}

function todayStamp(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const y = String(d.getFullYear()).slice(2)
  return `${m}.${day}.${y}`
}

function buildComment(form: VoucherGenerateForm): string {
  const rand3 = Math.floor(100 + Math.random() * 900)
  const stamp = todayStamp()
  const tail = form.comment.trim()
  const tailPart = tail ? `-${tail}` : ''
  return `${form.userType}-${rand3}-${stamp}${tailPart}`
}

export function generateBatch(form: VoucherGenerateForm): GeneratedVoucher[] {
  const charset = CHARSETS[form.charSet]
  const seen = new Set<string>()
  const result: GeneratedVoucher[] = []
  const comment = buildComment(form)

  let safetyCounter = 0
  const maxIter = form.qty * 10

  while (result.length < form.qty && safetyCounter < maxIter) {
    safetyCounter++
    const core = randomString(charset, form.nameLength)
    const username = `${form.prefix}${core}`

    if (seen.has(username)) continue
    seen.add(username)

    let password: string
    if (form.userType === 'vc') {
      password = username
    } else {
      const passLen = Math.max(3, Math.min(8, form.nameLength))
      password = randomString(CHARSETS.num, passLen)
    }

    result.push({
      id: `${result.length + 1}`,
      username,
      password,
      profile: form.profile,
      comment,
    })
  }

  return result
}

export function vouchersToCsv(vouchers: GeneratedVoucher[]): string {
  const lines = ['username,password,profile']
  for (const v of vouchers) {
    lines.push(`${v.username},${v.password},${v.profile}`)
  }
  return lines.join('\n')
}

export function dataLimitToBytes(
  value: number,
  unit: DataLimitUnit
): number {
  if (value <= 0) return 0
  if (unit === 'MB') return value * 1_048_576
  return value * 1_073_741_824
}
