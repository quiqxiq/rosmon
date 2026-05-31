import axios from 'axios'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { CustomerLoginRequest, CustomerLoginResponse } from '../../_shared/types'

// Public client — no auth token needed for login
const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const publicPortalClient = axios.create({
  baseURL: `${rawBase.replace(/\/+$/, '')}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

export async function customerLogin(payload: CustomerLoginRequest): Promise<CustomerLoginResponse> {
  const res = await publicPortalClient.post<Envelope<CustomerLoginResponse>>(
    '/customer/login',
    payload,
  )
  return unwrap(res.data)
}
