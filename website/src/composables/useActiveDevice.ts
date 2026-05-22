import { storeToRefs } from 'pinia'
import { useDeviceStore } from '@/stores/device'

export function useActiveDevice() {
  const store = useDeviceStore()
  const { activeDeviceId } = storeToRefs(store)

  return {
    activeDeviceId,
    setActiveDevice: store.setActiveDevice,
  }
}
