import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

export interface SystemSetting {
  key: string
  value: string
  value_type: 'string' | 'int' | 'bool' | 'secret'
  description?: string
  group_name?: string
}

export interface TestGatewayResult {
  success: boolean
  message: string
}

/** GET /settings — semua settings (secret field di-mask server side) */
export async function listSettings(): Promise<SystemSetting[]> {
  const res = await apiClient.get<Envelope<SystemSetting[]>>('/settings')
  return unwrap(res.data)
}

/** PUT /settings/:key — update satu setting */
export async function updateSetting(key: string, value: string): Promise<void> {
  await apiClient.put(`/settings/${encodeURIComponent(key)}`, { value })
}

/** POST /settings/payment-gateway/test — test koneksi Xendit */
export async function testPaymentGateway(): Promise<TestGatewayResult> {
  const res = await apiClient.post<TestGatewayResult>('/settings/payment-gateway/test')
  return res.data
}
