import { type PrintJob } from '../store/print-store'

export function qrImageUrl(data: string, size = 110): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

export function defaultNote(meta: PrintJob['meta']): string {
  return (
    meta.note ??
    `Berlaku ${meta.validity}. Login ke WiFi lalu ketik username & password di portal.`
  )
}
