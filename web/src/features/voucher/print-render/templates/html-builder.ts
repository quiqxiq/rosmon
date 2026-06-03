import { type PrintJob, type PrintTemplate } from '../store/print-store'
import { humanizeValidity, qrImageUrl, rupiah } from './template-shared'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// CSS bersama semua template — port dari <style> di web/template/header.*.txt.
const SHARED_CSS = `
  body {
    color: #000;
    background: #fff;
    font-size: 14px;
    font-family: 'Helvetica', Arial, sans-serif;
    margin: 0;
    padding: 8px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table.voucher {
    display: inline-block;
    border: 2px solid #000;
    margin: 2px;
    vertical-align: top;
    border-collapse: collapse;
  }
  table.voucher td, table.voucher th { padding: 2px 4px; }
  .num { float: right; display: inline-block; }
  .rotate { max-width: 15px; white-space: nowrap; vertical-align: bottom; padding-right: 5px; }
  .rotate > div { transform: rotate(-90deg); }
  .qrcode { height: 60px; width: 60px; }
  @page { size: auto; margin: 8mm 3mm 3mm 7mm; }
  @media print {
    body { padding: 0; }
    table { page-break-after: auto }
    tr { page-break-inside: avoid; page-break-after: auto }
    td { page-break-inside: avoid; page-break-after: auto }
  }
`

// ── default (web/template/*.default.txt) ─────────────────────────────────────
function renderDefault(job: PrintJob): string {
  const m = job.meta
  const priceStr = `Rp ${rupiah(m.sellingPrice)}`
  const validity = escapeHtml(humanizeValidity(m.validity))
  const timeLimit = escapeHtml(m.timeLimit ?? '')
  const dataLimit = escapeHtml(m.dataLimit ?? '')
  const hotspotName = escapeHtml(m.hotspotName || m.title || m.profile)
  const loginUrl = escapeHtml(m.loginUrl ?? '')

  const cards = job.vouchers
    .map((v, i) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const isVoucher = v.username === v.password
      const qr = escapeHtml(
        qrImageUrl(isVoucher ? v.username : `${v.username}:${v.password}`, 60),
      )
      const creds = isVoucher
        ? `<td class="vc">${username}</td>`
        : `<td class="up">User: ${username}<br>Pass: ${password}</td>`
      const loginRow = loginUrl
        ? `<td colspan="3" style="font-size:10px;">Login: http://${loginUrl} <span class="num">[${i + 1}]</span></td>`
        : `<td colspan="3" style="font-size:10px;"><span class="num">[${i + 1}]</span></td>`
      return `
      <table class="voucher" style="width:230px;">
        <tbody>
          <tr>
            <td style="font-weight:bold;border-right:2px dashed #000;" class="rotate" rowspan="4"><div>${escapeHtml(priceStr)}</div></td>
            <td style="font-weight:bold;" colspan="2">${hotspotName}</td>
            <td rowspan="3"><img class="qrcode" src="${qr}" alt="qr"></td>
          </tr>
          <tr>${creds}</tr>
          <tr>
            <td style="font-size:10px;">${validity} ${timeLimit} ${dataLimit}</td>
          </tr>
          <tr>${loginRow}</tr>
        </tbody>
      </table>`
    })
    .join('')

  const css = `
    .vc { width:100%; font-weight:bold; font-size:18px; text-align:center; }
    .up { width:100%; font-weight:bold; font-size:13px; text-align:left; }
    .qrcode { height:60px; width:60px; }
  `
  return wrapDocument('Voucher — Default', css, cards)
}

// ── small (web/template/*.small.txt) ─────────────────────────────────────────
function renderSmall(job: PrintJob): string {
  const m = job.meta
  const priceStr = `Rp ${rupiah(m.sellingPrice)}`
  const validity = escapeHtml(humanizeValidity(m.validity))
  const timeLimit = escapeHtml(m.timeLimit ?? '')
  const dataLimit = escapeHtml(m.dataLimit ?? '')
  const hotspotName = escapeHtml(m.hotspotName || m.title || m.profile)

  const cards = job.vouchers
    .map((v, i) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const isVoucher = v.username === v.password
      const headRow = isVoucher
        ? `<td colspan="2" style="font-size:10px;">Voucher</td>`
        : `<td style="font-size:10px;">Username</td><td style="font-size:10px;">Password</td>`
      const credRow = isVoucher
        ? `<td colspan="2" style="border:1px solid #000;font-weight:bold;">${username}</td>`
        : `<td style="border:1px solid #000;font-weight:bold;">${username}</td><td style="border:1px solid #000;font-weight:bold;">${password}</td>`
      return `
      <table class="voucher" style="width:140px;">
        <thead>
          <tr>
            <th colspan="2" style="width:100%;text-align:left;font-size:12px;font-weight:bold;border-bottom:1px solid #000;">${hotspotName}<span class="num">${i + 1}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-size:10px;text-align:center;">${headRow}</tr>
          <tr style="font-size:12px;text-align:center;">${credRow}</tr>
        </tbody>
        <tfoot>
          <tr style="font-size:10px;text-align:center;">
            <th colspan="2">${validity} ${timeLimit} ${dataLimit} ${escapeHtml(priceStr)}</th>
          </tr>
        </tfoot>
      </table>`
    })
    .join('')

  return wrapDocument('Voucher — Small', '', cards)
}

// ── thermal (web/template/*.thermal.txt) ─────────────────────────────────────
function renderThermal(job: PrintJob): string {
  const m = job.meta
  const priceStr = `Rp ${rupiah(m.sellingPrice)}`
  const validity = escapeHtml(humanizeValidity(m.validity))
  const timeLimit = escapeHtml(m.timeLimit ?? '')
  const dataLimit = escapeHtml(m.dataLimit ?? '')
  const hotspotName = escapeHtml(m.hotspotName || m.title || m.profile)
  const loginUrl = escapeHtml(m.loginUrl ?? '')
  const stamp = escapeHtml(new Date().toLocaleString('id-ID'))

  const cards = job.vouchers
    .map((v) => {
      const username = escapeHtml(v.username)
      const password = escapeHtml(v.password)
      const isVoucher = v.username === v.password
      const qr = escapeHtml(
        qrImageUrl(isVoucher ? v.username : `${v.username}:${v.password}`, 100),
      )
      const comment = escapeHtml(v.comment ?? '')
      const credBlock = isVoucher
        ? `<tr><td style="font-size:12px;">Kode Voucher</td></tr>
           <tr><td style="border:1px solid #000;font-weight:bold;font-size:16px;">${username}</td></tr>`
        : `<tr><td style="width:50%;">Username</td><td>Password</td></tr>
           <tr style="font-size:14px;"><td style="border:1px solid #000;font-weight:bold;">${username}</td><td style="border:1px solid #000;font-weight:bold;">${password}</td></tr>`
      const loginRow = loginUrl
        ? `<tr><td colspan="2" style="font-weight:bold;font-size:12px;">Login: http://${loginUrl}</td></tr>`
        : ''
      return `
      <table class="voucher" style="width:180px;">
        <tbody>
          <tr><td style="text-align:center;font-size:14px;font-weight:bold;">${hotspotName}</td></tr>
          <tr><td style="text-align:center;font-size:12px;border-bottom:1px solid #000;"><span>${stamp}</span></td></tr>
          <tr>
            <td>
              <table style="text-align:center;width:170px;font-size:12px;">
                <tbody>
                  <tr><td><table style="width:100%;"><tbody>${credBlock}</tbody></table></td></tr>
                  <tr><td colspan="2" style="border-top:1px solid #000;font-weight:bold;font-size:14px;">${validity} ${timeLimit} ${dataLimit}</td></tr>
                  <tr><td><span class="price">${escapeHtml(priceStr)}</span></td></tr>
                  <tr><td colspan="2"><img class="qrcode" style="height:100px;width:100px;" src="${qr}" alt="qr"><br>${comment}</td></tr>
                  ${loginRow}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>`
    })
    .join('')

  const css = `
    .price { font-size: 20px; }
    .qrcode { height:100px; width:100px; }
  `
  return wrapDocument('Voucher — Thermal', css, cards)
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
${body}
</body>
</html>`
}

export function buildPrintHtml(job: PrintJob): string {
  const renderers: Record<PrintTemplate, (j: PrintJob) => string> = {
    default: renderDefault,
    small: renderSmall,
    thermal: renderThermal,
  }
  return renderers[job.template](job)
}
