import { defineStore } from 'pinia'

interface DeviceState {
  activeDeviceId: string | null
}

export const useDeviceStore = defineStore('device', {
  state: (): DeviceState => ({
    activeDeviceId: null,
  }),
  actions: {
    setActiveDevice(id: string | null) {
      this.activeDeviceId = id
    },
  },
  persist: {
    pick: ['activeDeviceId'],
  },
})
