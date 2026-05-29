import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'

export function useSellingToday(rid: number) {
  return useQuery({
    queryKey: qk.reportSellingToday(rid),
    queryFn: () => svc.getSellingToday(rid),
    enabled: rid > 0,
  })
}

export function useSellingSummary(rid: number, month?: string) {
  return useQuery({
    queryKey: qk.reportSellingSummary(rid, { month }),
    queryFn: () => svc.getSellingSummary(rid, month),
    enabled: rid > 0,
  })
}

export function useSelling(rid: number, month?: string) {
  return useQuery({
    queryKey: qk.reportSelling(rid, { month }),
    queryFn: () => svc.getSelling(rid, month),
    enabled: rid > 0,
  })
}
