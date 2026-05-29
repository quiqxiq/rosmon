import { create } from 'zustand'
import { type AdminUser } from '../api/schema'

export type AdminUserDialogMode = 'add' | 'edit' | 'delete' | null

type State = {
  mode: AdminUserDialogMode
  target: AdminUser | null
  open: (
    mode: Exclude<AdminUserDialogMode, null>,
    payload?: { target?: AdminUser },
  ) => void
  close: () => void
}

// Local UI-only state for the admin-users dialogs. The actual user list
// is fetched via TanStack Query; this store just tracks which dialog is
// currently visible and (for edit/delete) which user row it targets.
export const useAdminUsersDialogStore = create<State>()((set) => ({
  mode: null,
  target: null,
  open: (mode, payload) => set({ mode, target: payload?.target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
