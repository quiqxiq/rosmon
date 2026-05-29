import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  ARPEntry,
  DHCPLease,
  IPPool,
  IPPoolCreateInput,
  SimpleQueue,
} from './schema'

const base = (rid: number) => `/devices/${rid}/network`

// ── IP Pools ──
export async function listPools(routerId: number): Promise<IPPool[]> {
  const res = await apiClient.get<Envelope<IPPool[]>>(`${base(routerId)}/pools`)
  return unwrap(res.data)
}

export async function createPool(
  routerId: number,
  payload: IPPoolCreateInput,
): Promise<void> {
  await apiClient.post(`${base(routerId)}/pools`, payload)
}

export async function deletePool(routerId: number, id: string): Promise<void> {
  await apiClient.delete(`${base(routerId)}/pools/${encodeURIComponent(id)}`)
}

// ── Simple Queues (static only) ──
export async function listQueues(routerId: number): Promise<SimpleQueue[]> {
  const res = await apiClient.get<Envelope<SimpleQueue[]>>(
    `${base(routerId)}/queues`,
    { params: { dynamic: 'false' } },
  )
  return unwrap(res.data)
}

export async function deleteQueue(routerId: number, id: string): Promise<void> {
  await apiClient.delete(`${base(routerId)}/queues/${encodeURIComponent(id)}`)
}

// ── DHCP Leases ──
export async function listDHCPLeases(routerId: number): Promise<DHCPLease[]> {
  const res = await apiClient.get<Envelope<DHCPLease[]>>(
    `${base(routerId)}/dhcp-leases`,
  )
  return unwrap(res.data)
}

export async function deleteDHCPLease(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(
    `${base(routerId)}/dhcp-leases/${encodeURIComponent(id)}`,
  )
}

// ── ARP (lookup by MAC — backend requires the mac query param) ──
export async function arpByMac(
  routerId: number,
  mac: string,
): Promise<ARPEntry[]> {
  const res = await apiClient.get<Envelope<ARPEntry[]>>(
    `${base(routerId)}/arp`,
    { params: { mac } },
  )
  return unwrap(res.data)
}
