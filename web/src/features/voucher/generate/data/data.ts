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
  { label: 'Huruf Kecil (abcd)', value: 'lower' },
  { label: 'Huruf Besar (ABCD)', value: 'upper' },
  { label: 'Huruf Besar+Kecil (aBcD)', value: 'mixed' },
  { label: 'Angka Saja (1234)', value: 'number' },
  { label: 'Angka+Huruf Kecil (5ab2c)', value: 'lower_number' },
  { label: 'Angka+Huruf Besar (5AB2C)', value: 'upper_number' },
  { label: 'Angka+Besar+Kecil (5aB2C)', value: 'mixed_number' },
]

export const nameLengthOptions = [4, 5, 6, 7, 8, 10, 12].map((n) => ({
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


export const defaultGenerateForm: VoucherGenerateForm = {
  qty: 1,
  server: 'all',
  // profile is intentionally empty — index.tsx sets it from the first
  // real profile returned by useHotspotProfiles via a useEffect.
  profile: '',
  userType: 'up',
  nameLength: 6,
  charSet: 'lower_number',
  prefix: '',
  timeLimit: '0',
  dataLimit: 0,
  dataLimitUnit: 'MB',
  comment: '',
}

const CHARSETS: Record<CharSet, string> = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  mixed: 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
  number: '23456789',
  lower_number: 'abcdefghjkmnpqrstuvwxyz23456789',
  upper_number: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  mixed_number: 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
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
      password = randomString(CHARSETS.number, passLen)
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
