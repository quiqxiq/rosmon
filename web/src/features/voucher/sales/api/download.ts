// Trigger a browser file download from an in-memory Blob.
//
// Centralised so the Daily and Monthly export menus stay in lockstep —
// they both fetch a Blob from the report API and need the same anchor
// click + URL.revokeObjectURL cleanup.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke until after the click event has been fully processed by
  // the browser; revoking synchronously is fine in practice but a setTimeout
  // is the cross-browser-safe pattern recommended by MDN.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
