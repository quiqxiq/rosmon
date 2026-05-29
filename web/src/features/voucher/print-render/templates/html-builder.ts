import { type PrintJob, type PrintTemplate } from '../store/print-store'
import { defaultNote, qrImageUrl, rupiah } from './template-shared'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #fff;
    color: #111;
  }
  body { padding: 12px; }
  @page { margin: 8mm; }
  @media print {
    body { padding: 0; }
    .voucher { page-break-inside: avoid; }
  }
`

const DEFAULT_CSS = `
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .voucher {
    border: 1px dashed #888;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fff;
  }
  .voucher .package {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: #444;
  }
  .voucher .price {
    float: right;
    font-size: 12px;
    font-weight: 700;
    color: #047857;
  }
  .voucher .creds {
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .voucher .creds .col { flex: 1; }
  .voucher .creds .label {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
  }
  .voucher .creds .value {
    font-family: ui-monospace, monospace;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: .04em;
  }
  .voucher .meta {
    margin-top: 6px;
    font-size: 10px;
    color: #555;
    display: flex;
    justify-content: space-between;
  }
  .voucher .note {
    margin-top: 6px;
    border-top: 1px dashed #bbb;
    padding-top: 4px;
    font-size: 9px;
    color: #555;
    line-height: 1.3;
  }
`

const QR_CSS = `
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .voucher {
    border: 1px solid #444;
    border-radius: 6px;
    padding: 10px;
    background: #fff;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .voucher .qr {
    width: 110px;
    height: 110px;
    flex: 0 0 110px;
  }
  .voucher .qr img { width: 110px; height: 110px; display: block; }
  .voucher .info { flex: 1; min-width: 0; }
  .voucher .info .package {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #444;
  }
  .voucher .info .username {
    font-family: ui-monospace, monospace;
    font-size: 16px;
    font-weight: 700;
  }
  .voucher .info .password {
    font-family: ui-monospace, monospace;
    font-size: 13px;
    color: #444;
  }
  .voucher .info .meta {
    margin-top: 4px;
    font-size: 10px;
    color: #555;
  }
  .voucher .info .price {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 700;
    color: #047857;
  }
`

const SMALL_CSS = `
  body { padding: 4px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }
  .voucher {
    border: 1px dashed #444;
    border-radius: 4px;
    padding: 6px 8px;
    background: #fff;
    text-align: center;
  }
  .voucher .package {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: #555;
  }
  .voucher .username {
    font-family: ui-monospace, monospace;
    font-size: 13px;
    font-weight: 700;
    margin-top: 2px;
  }
  .voucher .password {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #444;
  }
  .voucher .meta {
    font-size: 8px;
    color: #666;
    margin-top: 3px;
  }
`

function renderDefault(job: PrintJob): string {
  const note = escapeHtml(defaultNote(job.meta))
  const cards = job.vouchers
    .map((v) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const isVoucher = v.username === v.password
      return `
        <div class="voucher">
          <span class="price">Rp ${rupiah(job.meta.sellingPrice)}</span>
          <div class="package">${escapeHtml(job.meta.title ?? job.meta.profile)}</div>
          <div class="creds">
            ${
              isVoucher
                ? `<div class="col"><div class="label">Voucher Code</div><div class="value">${username}</div></div>`
                : `<div class="col"><div class="label">Username</div><div class="value">${username}</div></div>
                   <div class="col"><div class="label">Password</div><div class="value">${password}</div></div>`
            }
          </div>
          <div class="meta">
            <span>${escapeHtml(job.meta.server)}</span>
            <span>${escapeHtml(job.meta.validity)}</span>
          </div>
          <div class="note">${note}</div>
        </div>`
    })
    .join('')
  return wrapDocument('Voucher Print — Default', DEFAULT_CSS, cards)
}

function renderQr(job: PrintJob): string {
  const cards = job.vouchers
    .map((v) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const qrPayload = `${v.username}:${v.password}`
      const qrUrl = qrImageUrl(qrPayload, 110)
      return `
        <div class="voucher">
          <div class="qr"><img src="${escapeHtml(qrUrl)}" alt="qr" /></div>
          <div class="info">
            <div class="package">${escapeHtml(job.meta.title ?? job.meta.profile)}</div>
            <div class="username">${username}</div>
            <div class="password">${password}</div>
            <div class="meta">${escapeHtml(job.meta.server)} · ${escapeHtml(job.meta.validity)}</div>
            <div class="price">Rp ${rupiah(job.meta.sellingPrice)}</div>
          </div>
        </div>`
    })
    .join('')
  return wrapDocument('Voucher Print — QR', QR_CSS, cards)
}

function renderSmall(job: PrintJob): string {
  const cards = job.vouchers
    .map((v) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const isVoucher = v.username === v.password
      return `
        <div class="voucher">
          <div class="package">${escapeHtml(job.meta.title ?? job.meta.profile)}</div>
          <div class="username">${username}</div>
          ${isVoucher ? '' : `<div class="password">${password}</div>`}
          <div class="meta">${escapeHtml(job.meta.validity)} · Rp ${rupiah(job.meta.sellingPrice)}</div>
        </div>`
    })
    .join('')
  return wrapDocument('Voucher Print — Small', SMALL_CSS, cards)
}

function wrapDocument(title: string, css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${SHARED_CSS}${css}</style>
</head>
<body>
<div class="grid">
${body}
</div>
</body>
</html>`
}

export function buildPrintHtml(job: PrintJob): string {
  const renderers: Record<PrintTemplate, (j: PrintJob) => string> = {
    default: renderDefault,
    qr: renderQr,
    small: renderSmall,
  }
  return renderers[job.template](job)
}
