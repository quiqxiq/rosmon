export interface NetworkInterface {
  id: string
  name: string
  type: string
  running: boolean
  disabled: boolean
  macAddress?: string
  rxBytes?: number
  txBytes?: number
}

export interface IPPool {
  id: string
  name: string
  ranges: string
  nextPool?: string
}

export interface ARPEntry {
  id: string
  address: string
  macAddress: string
  interface: string
  dynamic: boolean
}

export interface DHCPLease {
  id: string
  address: string
  macAddress: string
  clientId?: string
  hostName?: string
  server?: string
  status: string
}

export interface SimpleQueue {
  id: string
  name: string
  target: string
  maxLimit?: string
  burstLimit?: string
  disabled?: boolean
}
