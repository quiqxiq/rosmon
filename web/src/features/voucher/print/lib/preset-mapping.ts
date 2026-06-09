import type { QuickPrintPackage } from '@/features/voucher/print/api/schema'
import {
  defaultColorFor,
  useQuickPrintPresetsMetaStore,
} from '@/stores/quick-print-presets-meta-store'
import type {
  PresetColor,
  QuickPrintPreset,
} from '../data/schema'

// Bridge between the rich UI preset model (numbers, booleans, color +
// package label) and the all-strings backend `QuickPrintPackage`. Lives
// here, not in api/, because the impedance mismatch is purely UI-side
// (api/schema.ts mirrors the wire format exactly).

const VALID_USER_MODES: QuickPrintPreset['userMode'][] = ['vc', 'up']
const VALID_CHAR_SETS: QuickPrintPreset['charSet'][] = [
  'lower',
  'upper',
  'mixed',
  'number',
  'lower_number',
  'upper_number',
  'mixed_number',
]

function safeUserMode(s: string): QuickPrintPreset['userMode'] {
  return VALID_USER_MODES.includes(s as QuickPrintPreset['userMode'])
    ? (s as QuickPrintPreset['userMode'])
    : 'up'
}

function safeCharSet(s: string): QuickPrintPreset['charSet'] {
  return VALID_CHAR_SETS.includes(s as QuickPrintPreset['charSet'])
    ? (s as QuickPrintPreset['charSet'])
    : 'lower_number'
}

function parseInt0(s: string): number {
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

// Splits a backend `data_limit` string like "100MB" / "1GB" / "" into
// the UI's (number, unit) tuple. Bytes-style values ("104857600") fall
// back to MB so the user can still see and edit them.
function parseDataLimit(s: string): {
  value: number
  unit: QuickPrintPreset['dataLimitUnit']
} {
  const trimmed = s.trim().toUpperCase()
  if (trimmed.endsWith('GB')) {
    return { value: parseInt0(trimmed.slice(0, -2)), unit: 'GB' }
  }
  if (trimmed.endsWith('MB')) {
    return { value: parseInt0(trimmed.slice(0, -2)), unit: 'MB' }
  }
  // Numeric-only string → assume bytes; convert to MB for the UI.
  const bytes = parseInt0(trimmed)
  if (bytes > 0) {
    return { value: Math.round(bytes / 1_048_576), unit: 'MB' }
  }
  return { value: 0, unit: 'MB' }
}

// Combine API record + local UI metadata into a full preset for display.
// Falls back to a deterministic color hash so unseen presets still look
// distinct without mandatory user input.
export function apiToPreset(
  api: QuickPrintPackage,
  meta?: { color: PresetColor; packageLabel: string },
): QuickPrintPreset {
  const dl = parseDataLimit(api.data_limit)
  return {
    // Backend identifies packages by `name`; the UI uses `id` on the
    // type so we just reuse the name for both — they're guaranteed
    // unique per router on the backend side.
    id: api.name,
    name: api.name,
    package: meta?.packageLabel ?? api.name,
    server: api.server || 'all',
    userMode: safeUserMode(api.user_mode),
    userLength: parseInt0(api.user_length) || 5,
    prefix: api.prefix,
    charSet: safeCharSet(api.char_mode),
    profile: api.profile,
    timeLimit: api.time_limit || '0',
    dataLimit: dl.value,
    dataLimitUnit: dl.unit,
    validity: api.validity,
    price: parseInt0(api.price),
    sellingPrice: parseInt0(api.selling_price),
    lockUser: api.lock_user === '1' || api.lock_user.toLowerCase() === 'true',
    color: meta?.color ?? defaultColorFor(api.name),
  }
}

// Convert a UI preset back to the all-strings backend body. The local
// meta (color + packageLabel) is NOT serialized here — the caller stores
// it via `useQuickPrintPresetsMetaStore` separately so the round-trip
// stays clean even if backend later adds a `metadata` field of its own.
export function presetToApi(preset: QuickPrintPreset): QuickPrintPackage {
  const dataLimitStr =
    preset.dataLimit > 0 ? `${preset.dataLimit}${preset.dataLimitUnit}` : ''
  return {
    name: preset.name,
    server: preset.server,
    user_mode: preset.userMode,
    user_length: String(preset.userLength),
    prefix: preset.prefix,
    char_mode: preset.charSet,
    profile: preset.profile,
    time_limit: preset.timeLimit,
    data_limit: dataLimitStr,
    comment: '',
    validity: preset.validity,
    price: String(preset.price),
    selling_price: String(preset.sellingPrice),
    lock_user: preset.lockUser ? '1' : '0',
  }
}

// Hook that yields preset records merged with their persisted UI meta.
// Reads the meta store reactively so a meta change (e.g. color picker)
// re-renders cards immediately even before the next fetch.
export function useApiPresetsWithMeta(
  apiPackages: QuickPrintPackage[] | undefined,
): QuickPrintPreset[] {
  const byName = useQuickPrintPresetsMetaStore((s) => s.byName)
  if (!apiPackages) return []
  return apiPackages.map((p) => apiToPreset(p, byName[p.name]))
}
