import { create } from 'zustand'
import { type MessageTemplate } from '../api/schema'

type DialogMode = 'edit' | null

type State = {
  mode: DialogMode
  target: MessageTemplate | null
  open: (mode: Exclude<DialogMode, null>, target: MessageTemplate) => void
  close: () => void
}

export const useMessageTemplatesDialogStore = create<State>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target }),
  close: () => set({ mode: null, target: null }),
}))
