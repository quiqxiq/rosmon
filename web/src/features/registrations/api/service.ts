import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  ApproveInput,
  AssignInput,
  CompleteInstallInput,
  Registration,
  RegistrationFilters,
  RejectInput,
} from './schema'

const base = '/registrations'

export async function listRegistrations(
  filters?: RegistrationFilters,
): Promise<Registration[]> {
  const res = await apiClient.get<Envelope<Registration[]>>(base, {
    params: filters,
  })
  return unwrap(res.data)
}

export async function approveRegistration(
  id: number,
  payload: ApproveInput,
): Promise<Registration> {
  const res = await apiClient.post<Envelope<Registration>>(
    `${base}/${id}/approve`,
    payload,
  )
  return unwrap(res.data)
}

export async function rejectRegistration(
  id: number,
  payload: RejectInput,
): Promise<Registration> {
  const res = await apiClient.post<Envelope<Registration>>(
    `${base}/${id}/reject`,
    payload,
  )
  return unwrap(res.data)
}

export async function assignRegistration(
  id: number,
  payload: AssignInput,
): Promise<Registration> {
  const res = await apiClient.put<Envelope<Registration>>(
    `${base}/${id}/assign`,
    payload,
  )
  return unwrap(res.data)
}

// Returns { subscription, invoice } — we only need to invalidate after.
export async function completeInstall(
  id: number,
  payload: CompleteInstallInput,
): Promise<unknown> {
  const res = await apiClient.post<Envelope<unknown>>(
    `${base}/${id}/complete-install`,
    payload,
  )
  return unwrap(res.data)
}
