export interface SystemIdentity {
  name: string
}

export interface SystemResource {
  uptime: string
  freeMemory: number
  totalMemory: number
  cpuLoad: number
  cpuFrequency?: number
  version: string
  boardName: string
  architectureName?: string
}

export interface Routerboard {
  routerboard: boolean
  model?: string
  serialNumber?: string
  firmwareType?: string
  currentFirmware?: string
  upgradeFirmware?: string
}

export interface SystemClock {
  time: string
  date: string
  timezone: string
}

export interface SystemScript {
  id: string
  name: string
  source: string
  policy?: string[]
  lastStarted?: string
  runCount?: number
}

export interface SystemScheduler {
  id: string
  name: string
  startDate: string
  startTime: string
  interval: string
  onEvent: string
  disabled?: boolean
}
