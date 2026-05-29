import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  DHCPLeaseRecord,
  InterfaceRecord,
  InterfaceTraffic,
  NATRuleRecord,
  PoolRecord,
  QueueRecord,
} from './schema'

const base = (rid: number) => `/devices/${rid}/network`

// GET /routers/{rid}/network/interfaces — list router interfaces.
export async function listInterfaces(
  routerId: number,
): Promise<InterfaceRecord[]> {
  const res = await apiClient.get<Envelope<InterfaceRecord[]>>(
    `${base(routerId)}/interfaces`,
  )
  return unwrap(res.data)
}

// GET /routers/{rid}/network/traffic/{iface} — live RX/TX snapshot.
export async function getInterfaceTraffic(
  routerId: number,
  iface: string,
): Promise<InterfaceTraffic> {
  const res = await apiClient.get<Envelope<InterfaceTraffic>>(
    `${base(routerId)}/traffic/${encodeURIComponent(iface)}`,
  )
  return unwrap(res.data)
}

// GET /routers/{rid}/network/queues — list simple queues.
export async function listQueues(routerId: number): Promise<QueueRecord[]> {
  const res = await apiClient.get<Envelope<QueueRecord[]>>(
    `${base(routerId)}/queues`,
  )
  return unwrap(res.data)
}

// GET /routers/{rid}/network/nat — list firewall NAT rules.
export async function listNATRules(routerId: number): Promise<NATRuleRecord[]> {
  const res = await apiClient.get<Envelope<NATRuleRecord[]>>(
    `${base(routerId)}/nat`,
  )
  return unwrap(res.data)
}

// GET /routers/{rid}/network/dhcp/leases — list DHCP server leases.
export async function listDHCPLeases(
  routerId: number,
): Promise<DHCPLeaseRecord[]> {
  const res = await apiClient.get<Envelope<DHCPLeaseRecord[]>>(
    `${base(routerId)}/dhcp/leases`,
  )
  return unwrap(res.data)
}

// GET /routers/{rid}/network/pools — list IP pools.
export async function listIPPools(routerId: number): Promise<PoolRecord[]> {
  const res = await apiClient.get<Envelope<PoolRecord[]>>(
    `${base(routerId)}/pools`,
  )
  return unwrap(res.data)
}
