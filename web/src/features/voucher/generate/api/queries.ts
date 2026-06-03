import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  VoucherGenerateParams,
  VoucherGenerateResult,
} from './schema'

// Prefix used for invalidation across the voucher session cache.
const voucherSessionPrefix = (routerId: number) =>
  ['voucher', 'session', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotServers(routerId: number) {
  return useQuery({
    queryKey: ['hotspot', 'servers', routerId],
    queryFn: () => svc.listHotspotServers(routerId),
    enabled: routerId > 0,
    staleTime: 60_000,
  })
}

// Fetch a previously generated voucher batch by `gencode`. Exposed as a
// query (not a mutation) because print-render consumers typically read
// this reactively after a navigation. The `gencode` gate disables the
// query when absent so we never POST an empty body.
export function useCachedVouchers(routerId: number, gencode: string) {
  return useQuery({
    queryKey: qk.voucherSession(routerId, gencode),
    queryFn: () => svc.getCachedVouchers(routerId, gencode),
    enabled: routerId > 0 && gencode.length > 0,
  })
}

// ─────────────────── Mutations ───────────────────

// Generate a new voucher batch. Seeds `qk.voucherSession(...)` on success
// so the subsequent `useCachedVouchers(gencode)` read hits without another
// network round-trip.
export function useGenerateVoucher(routerId: number) {
  const qc = useQueryClient()
  return useMutation<VoucherGenerateResult, Error, VoucherGenerateParams>({
    mutationFn: (params) => svc.generateVoucher(routerId, params),
    onSuccess: (data) => {
      qc.setQueryData(qk.voucherSession(routerId, data.gencode), data)
      qc.invalidateQueries({ queryKey: voucherSessionPrefix(routerId) })
    },
  })
}
