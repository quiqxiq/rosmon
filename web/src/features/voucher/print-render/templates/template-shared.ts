export function qrImageUrl(data: string, size = 110): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

// humanizeValidity memformat durasi RouterOS singkat ke Bahasa Indonesia,
// port dari fungsi `nice()` di web/template/footer.*.txt.
// Contoh: "7d" → "7 hari", "1h" → "1 jam", "2w" → "2 minggu".
// Nilai yang tidak dikenal dikembalikan apa adanya.
export function humanizeValidity(v: string): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  const unit = s.slice(-1)
  const num = s.slice(0, -1)
  const map: Record<string, string> = {
    d: 'hari',
    h: 'jam',
    w: 'minggu',
    m: 'bulan',
  }
  if (map[unit] && /^\d+$/.test(num)) {
    return `${num} ${map[unit]}`
  }
  return s
}
