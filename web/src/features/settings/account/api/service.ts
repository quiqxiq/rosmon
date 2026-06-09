import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'

export type MeResponse = {
  id: number
  username: string
  email: string
  role: string
  active: boolean
  created_at: string
  updated_at: string
}

export type UpdateMePayload = {
  email?: string
  current_password?: string
  new_password?: string
}

export async function getMe(): Promise<MeResponse> {
  const res = await apiClient.get<Envelope<MeResponse>>('/auth/me')
  return unwrap(res.data)
}

export async function updateMe(payload: UpdateMePayload): Promise<MeResponse> {
  const res = await apiClient.put<Envelope<MeResponse>>('/auth/me', payload)
  return unwrap(res.data)
}
