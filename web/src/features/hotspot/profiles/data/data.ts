import { faker } from '@faker-js/faker'
import { type ExpMode, type HotspotProfile } from './schema'

faker.seed(100)

const PROFILE_TEMPLATES: Array<{
  name: string
  rateLimit: string
  validity: string
  basePrice: number
  shared: string
}> = [
  { name: '1jam-1k', rateLimit: '1M/1M', validity: '1h', basePrice: 1000, shared: '1' },
  { name: '3jam-2k', rateLimit: '2M/2M', validity: '3h', basePrice: 2000, shared: '1' },
  { name: '6jam-3k', rateLimit: '2M/2M', validity: '6h', basePrice: 3000, shared: '1' },
  { name: '12jam-4k', rateLimit: '3M/3M', validity: '12h', basePrice: 4000, shared: '1' },
  { name: '1hari-5k', rateLimit: '3M/3M', validity: '1d', basePrice: 5000, shared: '1' },
  { name: '3hari-12k', rateLimit: '5M/5M', validity: '3d', basePrice: 12000, shared: '2' },
  { name: '7hari-25k', rateLimit: '5M/5M', validity: '7d', basePrice: 25000, shared: '2' },
  { name: '14hari-45k', rateLimit: '10M/10M', validity: '14d', basePrice: 45000, shared: '3' },
  { name: '30hari-75k', rateLimit: '10M/10M', validity: '30d', basePrice: 75000, shared: '5' },
  { name: 'unlimited-150k', rateLimit: '20M/20M', validity: '30d', basePrice: 150000, shared: 'unlimited' },
]

const expModes: ExpMode[] = ['rem', 'ntf', 'remc', 'ntfc', 'none']

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export const expModeLabels: Record<ExpMode, string> = {
  rem: 'Remove',
  ntf: 'Notice',
  remc: 'Remove & Record',
  ntfc: 'Notice & Record',
  none: 'None',
}

export const expModeOptions = (Object.keys(expModeLabels) as ExpMode[]).map((value) => ({
  label: expModeLabels[value],
  value,
}))

export const monitorOptions = [
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

export const hotspotProfilesSeed: HotspotProfile[] = PROFILE_TEMPLATES.map((tpl) => {
  const expMode = faker.helpers.arrayElement(expModes)
  const margin = faker.number.int({ min: 0, max: 30 }) / 100
  const sellingPrice = Math.round(tpl.basePrice * (1 + margin))
  return {
    id: `*${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
    name: tpl.name,
    sharedUsers: tpl.shared,
    rateLimit: tpl.rateLimit,
    expMode,
    validity: tpl.validity,
    price: tpl.basePrice,
    sellingPrice,
    lockUser: faker.datatype.boolean({ probability: 0.6 }),
    lockServer: faker.datatype.boolean({ probability: 0.3 }),
    addressPool: 'hs-pool-1',
    parentQueue: faker.helpers.arrayElement(['none', 'global', 'hs-parent']),
    hasExpiredMonitor: faker.datatype.boolean({ probability: 0.7 }),
  }
})

export const profileNameOptions = hotspotProfilesSeed.map((p) => ({
  label: p.name,
  value: p.name,
}))
