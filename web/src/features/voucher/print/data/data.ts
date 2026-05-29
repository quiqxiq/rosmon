import { hotspotProfilesSeed } from '@/features/hotspot/profiles/data/data'
import { type PresetColor, type QuickPrintPreset } from './schema'

const COLORS: PresetColor[] = [
  'blue',
  'indigo',
  'purple',
  'pink',
  'red',
  'amber',
  'green',
  'teal',
  'cyan',
  'sky',
]

export const colorClassMap: Record<
  PresetColor,
  { bg: string; text: string; border: string; ring: string }
> = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-l-blue-500',
    ring: 'group-hover:ring-blue-500/40',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-l-indigo-500',
    ring: 'group-hover:ring-indigo-500/40',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-l-purple-500',
    ring: 'group-hover:ring-purple-500/40',
  },
  pink: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-l-pink-500',
    ring: 'group-hover:ring-pink-500/40',
  },
  red: {
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-l-red-500',
    ring: 'group-hover:ring-red-500/40',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-l-amber-500',
    ring: 'group-hover:ring-amber-500/40',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-l-green-500',
    ring: 'group-hover:ring-green-500/40',
  },
  teal: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-l-teal-500',
    ring: 'group-hover:ring-teal-500/40',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-l-cyan-500',
    ring: 'group-hover:ring-cyan-500/40',
  },
  sky: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-l-sky-500',
    ring: 'group-hover:ring-sky-500/40',
  },
}

const PRESET_TEMPLATES: Array<{
  name: string
  packageLabel: string
  server: string
  profileIndex: number
  userMode: 'vc' | 'up'
  userLength: number
  prefix: string
  charSet: 'lower' | 'upper' | 'upplow' | 'mix' | 'mix1' | 'mix2' | 'num'
  timeLimit: string
  dataLimit: number
  dataLimitUnit: 'MB' | 'GB'
}> = [
  {
    name: 'QP1',
    packageLabel: '1Jam-1K',
    server: 'HS-01',
    profileIndex: 0,
    userMode: 'up',
    userLength: 4,
    prefix: '',
    charSet: 'mix',
    timeLimit: '1h',
    dataLimit: 0,
    dataLimitUnit: 'MB',
  },
  {
    name: 'QP2',
    packageLabel: '3Jam-2K',
    server: 'HS-01',
    profileIndex: 1,
    userMode: 'up',
    userLength: 5,
    prefix: '',
    charSet: 'mix',
    timeLimit: '3h',
    dataLimit: 0,
    dataLimitUnit: 'MB',
  },
  {
    name: 'QP3',
    packageLabel: '6Jam-3K',
    server: 'HS-02',
    profileIndex: 2,
    userMode: 'vc',
    userLength: 6,
    prefix: '',
    charSet: 'mix2',
    timeLimit: '6h',
    dataLimit: 500,
    dataLimitUnit: 'MB',
  },
  {
    name: 'QP4',
    packageLabel: '12Jam-4K',
    server: 'HS-02',
    profileIndex: 3,
    userMode: 'vc',
    userLength: 6,
    prefix: '',
    charSet: 'mix',
    timeLimit: '12h',
    dataLimit: 1,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP5',
    packageLabel: '1Hari-5K',
    server: 'HS-01',
    profileIndex: 4,
    userMode: 'vc',
    userLength: 6,
    prefix: 'wifi',
    charSet: 'mix',
    timeLimit: '1d',
    dataLimit: 2,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP6',
    packageLabel: '3Hari-12K',
    server: 'HS-03',
    profileIndex: 5,
    userMode: 'up',
    userLength: 6,
    prefix: '',
    charSet: 'upplow',
    timeLimit: '3d',
    dataLimit: 5,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP7',
    packageLabel: '7Hari-25K',
    server: 'HS-03',
    profileIndex: 6,
    userMode: 'up',
    userLength: 7,
    prefix: '',
    charSet: 'mix2',
    timeLimit: '7d',
    dataLimit: 10,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP8',
    packageLabel: '14Hari-45K',
    server: 'HS-01',
    profileIndex: 7,
    userMode: 'vc',
    userLength: 7,
    prefix: 'pro',
    charSet: 'mix1',
    timeLimit: '14d',
    dataLimit: 25,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP9',
    packageLabel: '30Hari-75K',
    server: 'HS-02',
    profileIndex: 8,
    userMode: 'up',
    userLength: 8,
    prefix: '',
    charSet: 'mix2',
    timeLimit: '30d',
    dataLimit: 50,
    dataLimitUnit: 'GB',
  },
  {
    name: 'QP10',
    packageLabel: 'Unlimited-150K',
    server: 'HS-03',
    profileIndex: 9,
    userMode: 'vc',
    userLength: 8,
    prefix: 'plus',
    charSet: 'mix2',
    timeLimit: '30d',
    dataLimit: 0,
    dataLimitUnit: 'MB',
  },
]

export const quickPrintPresetsSeed: QuickPrintPreset[] = PRESET_TEMPLATES.map(
  (tpl, i) => {
    const profile =
      hotspotProfilesSeed[tpl.profileIndex] ?? hotspotProfilesSeed[0]
    return {
      id: `*qp${(i + 1).toString().padStart(2, '0')}`,
      name: tpl.name,
      package: tpl.packageLabel,
      server: tpl.server,
      userMode: tpl.userMode,
      userLength: tpl.userLength,
      prefix: tpl.prefix,
      charSet: tpl.charSet,
      profile: profile.name,
      timeLimit: tpl.timeLimit,
      dataLimit: tpl.dataLimit,
      dataLimitUnit: tpl.dataLimitUnit,
      validity: profile.validity,
      price: profile.price,
      sellingPrice: profile.sellingPrice,
      lockUser: profile.lockUser,
      color: COLORS[i % COLORS.length],
    }
  }
)

export function formatDataLimit(preset: QuickPrintPreset): string {
  if (preset.dataLimit <= 0) return 'Unlimited'
  return `${preset.dataLimit} ${preset.dataLimitUnit}`
}
