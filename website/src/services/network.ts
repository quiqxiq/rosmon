import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { ARPEntry, DHCPLease, IPPool, NetworkInterface, SimpleQueue } from '@/types/network'

const base = (deviceId: string) => `/devices/${deviceId}/network`

export const networkService = {
  async listInterfaces(deviceId: string): Promise<NetworkInterface[]> {
    const { data } = await http.get<ApiEnvelope<NetworkInterface[]>>(`${base(deviceId)}/interfaces`)
    return data.data
  },
  async listIPPools(deviceId: string): Promise<IPPool[]> {
    const { data } = await http.get<ApiEnvelope<IPPool[]>>(`${base(deviceId)}/ip-pools`)
    return data.data
  },
  async createIPPool(deviceId: string, payload: Partial<IPPool>): Promise<IPPool> {
    const { data } = await http.post<ApiEnvelope<IPPool>>(`${base(deviceId)}/ip-pools`, payload)
    return data.data
  },
  async removeIPPool(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/ip-pools/${id}`)
  },
  async listARP(deviceId: string): Promise<ARPEntry[]> {
    const { data } = await http.get<ApiEnvelope<ARPEntry[]>>(`${base(deviceId)}/arp`)
    return data.data
  },
  async listDHCPLeases(deviceId: string): Promise<DHCPLease[]> {
    const { data } = await http.get<ApiEnvelope<DHCPLease[]>>(`${base(deviceId)}/dhcp-leases`)
    return data.data
  },
  async listQueues(deviceId: string): Promise<SimpleQueue[]> {
    const { data } = await http.get<ApiEnvelope<SimpleQueue[]>>(`${base(deviceId)}/simple-queues`)
    return data.data
  },
}
