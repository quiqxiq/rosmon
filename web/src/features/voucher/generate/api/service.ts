import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  VoucherGenerateParams,
  VoucherGenerateResult,
} from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/vouchers`

export type HotspotServerItem = {
  name: string
  profile: string
  interface: string
  disabled: boolean
}

export async function listHotspotServers(routerId: number): Promise<HotspotServerItem[]> {
  const res = await apiClient.get<Envelope<HotspotServerItem[]>>(
    `/devices/${routerId}/hotspot/servers`,
  )
  return unwrap(res.data)
}

// POST /routers/:routerId/vouchers/generate — bulk-creates hotspot users
// on the router and caches the session in Redis (TTL: `TTLVoucherSession`,
// see `pkg/redis/cache.go`). The returned `gencode` is the handle for the
// subsequent print flow.
export async function generateVoucher(
  routerId: number,
  params: VoucherGenerateParams,
): Promise<VoucherGenerateResult> {
  const res = await apiClient.post<Envelope<VoucherGenerateResult>>(
    `${base(routerId)}/generate`,
    params,
  )
  return unwrap(res.data)
}

// POST /routers/:routerId/vouchers/cache — fetches a previously cached
// voucher session by `gencode`. Used by print-render to replay the exact
// voucher list without re-generating. Returns 404 when the session expired.
export async function getCachedVouchers(
  routerId: number,
  gencode: string,
): Promise<VoucherGenerateResult> {
  const res = await apiClient.post<Envelope<VoucherGenerateResult>>(
    `${base(routerId)}/cache`,
    { gencode },
  )
  return unwrap(res.data)
}
