import { create } from 'zustand'
import { type GeneratedVoucher } from '@/features/voucher/generate/data/schema'

export type PrintTemplate = 'default' | 'small' | 'thermal'

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
    // hotspotName + loginUrl ditampilkan di template (port dari mikhmon
    // web/template/). Diisi dari system settings (general.company_name,
    // general.hotspot_login_url) oleh pemanggil openPrint.
    hotspotName?: string
    loginUrl?: string
    // timeLimit & dataLimit batch (opsional) untuk baris detail voucher.
    timeLimit?: string
    dataLimit?: string
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
