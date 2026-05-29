import { create } from 'zustand'
import { type GeneratedVoucher } from '@/features/voucher/generate/data/schema'

export type PrintTemplate = 'default' | 'qr' | 'small'

export type PrintJob = {
  template: PrintTemplate
  vouchers: GeneratedVoucher[]
  meta: {
    profile: string
    server: string
    validity: string
    sellingPrice: number
    note?: string
    title?: string
  }
}

type PrintState = {
  job: PrintJob | null
  open: (job: PrintJob) => void
  close: () => void
}

export const usePrintStore = create<PrintState>()((set) => ({
  job: null,
  open: (job) => set({ job }),
  close: () => set({ job: null }),
}))
