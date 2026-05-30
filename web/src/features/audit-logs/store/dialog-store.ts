import { create } from 'zustand'
import { type AuditLog } from '../api/schema'

type State = {
  target: AuditLog | null
  open: (target: AuditLog) => void
  close: () => void
}

export const useAuditLogDialogStore = create<State>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))
