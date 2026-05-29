import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  Scheduler,
  SchedulerCreateInput,
  Script,
  ScriptCreateInput,
  SystemClock,
  SystemIdentity,
  SystemLicense,
  SystemResource,
  SystemRouterboard,
} from './schema'

const base = (rid: number) => `/devices/${rid}/system`

export async function getIdentity(rid: number): Promise<SystemIdentity> {
  const res = await apiClient.get<Envelope<SystemIdentity>>(
    `${base(rid)}/identity`,
  )
  return unwrap(res.data)
}

export async function getResource(rid: number): Promise<SystemResource> {
  const res = await apiClient.get<Envelope<SystemResource>>(
    `${base(rid)}/resource`,
  )
  return unwrap(res.data)
}

export async function getRouterboard(rid: number): Promise<SystemRouterboard> {
  const res = await apiClient.get<Envelope<SystemRouterboard>>(
    `${base(rid)}/routerboard`,
  )
  return unwrap(res.data)
}

export async function getClock(rid: number): Promise<SystemClock> {
  const res = await apiClient.get<Envelope<SystemClock>>(`${base(rid)}/clock`)
  return unwrap(res.data)
}

export async function getLicense(rid: number): Promise<SystemLicense> {
  const res = await apiClient.get<Envelope<SystemLicense>>(
    `${base(rid)}/license`,
  )
  return unwrap(res.data)
}

export async function reboot(rid: number): Promise<void> {
  await apiClient.post(`${base(rid)}/reboot`)
}

export async function shutdown(rid: number): Promise<void> {
  await apiClient.post(`${base(rid)}/shutdown`)
}

// ── Scripts ──
export async function listScripts(rid: number): Promise<Script[]> {
  const res = await apiClient.get<Envelope<Script[]>>(`${base(rid)}/scripts`)
  return unwrap(res.data)
}

export async function createScript(
  rid: number,
  payload: ScriptCreateInput,
): Promise<void> {
  await apiClient.post(`${base(rid)}/scripts`, payload)
}

export async function deleteScript(rid: number, id: string): Promise<void> {
  await apiClient.delete(`${base(rid)}/scripts/${encodeURIComponent(id)}`)
}

// ── Schedulers ──
export async function listSchedulers(rid: number): Promise<Scheduler[]> {
  const res = await apiClient.get<Envelope<Scheduler[]>>(
    `${base(rid)}/schedulers`,
  )
  return unwrap(res.data)
}

export async function createScheduler(
  rid: number,
  payload: SchedulerCreateInput,
): Promise<void> {
  await apiClient.post(`${base(rid)}/schedulers`, payload)
}

export async function deleteScheduler(rid: number, id: string): Promise<void> {
  await apiClient.delete(`${base(rid)}/schedulers/${encodeURIComponent(id)}`)
}
