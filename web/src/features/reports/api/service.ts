import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { ReportSummary, ReportToday, Transaction } from './schema'

const base = (rid: number) => `/devices/${rid}/reports/selling`

export async function getSellingToday(rid: number): Promise<ReportToday> {
  const res = await apiClient.get<Envelope<ReportToday>>(`${base(rid)}/today`)
  return unwrap(res.data)
}

export async function getSellingSummary(
  rid: number,
  month?: string,
): Promise<ReportSummary> {
  const res = await apiClient.get<Envelope<ReportSummary>>(
    `${base(rid)}/summary`,
    { params: { month, include_transactions: true } },
  )
  return unwrap(res.data)
}

export async function getSelling(
  rid: number,
  month?: string,
): Promise<Transaction[]> {
  const res = await apiClient.get<Envelope<Transaction[]>>(base(rid), {
    params: { month },
  })
  return unwrap(res.data)
}
