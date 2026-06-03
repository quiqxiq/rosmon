import { apiClient } from '@/lib/api/client'

export type { SystemSetting } from '../../api/service'
export { listSettings, updateSetting } from '../../api/service'

export interface TestGatewayResult {
  success: boolean
  message: string
}

/** POST /settings/payment-gateway/test — test koneksi Xendit */
export async function testPaymentGateway(): Promise<TestGatewayResult> {
  const res = await apiClient.post<TestGatewayResult>('/settings/payment-gateway/test')
  return res.data
}
