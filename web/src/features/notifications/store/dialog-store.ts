import { create } from 'zustand'
import { type NotificationLog } from '../api/schema'

type State = {
  target: NotificationLog | null
  open: (target: NotificationLog) => void
  close: () => void
}

export const useNotificationDialogStore = create<State>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))
