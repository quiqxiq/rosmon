export interface PPPSecret {
  id: string
  name: string
  password?: string
  service: string
  profile: string
  localAddress?: string
  remoteAddress?: string
  callerId?: string
  disabled?: boolean
  comment?: string
}

export interface PPPProfile {
  id: string
  name: string
  localAddress?: string
  remoteAddress?: string
  rateLimit?: string
  sessionTimeout?: string
  onlyOne?: 'yes' | 'no' | 'default'
}

export interface PPPActive {
  id: string
  name: string
  service: string
  callerId?: string
  address?: string
  uptime: string
  encoding?: string
}

export interface PPPInactiveEvent {
  name: string
  profile: string
  lastSeenAddress?: string
  lastSeenAt?: string
}
