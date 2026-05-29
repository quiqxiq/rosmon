import { useEffect, useMemo, useRef } from 'react'
import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePrintStore } from '../store/print-store'
import { buildPrintHtml } from '../templates/html-builder'

const TEMPLATE_LABELS = {
  default: 'Default',
  qr: 'QR Code',
  small: 'Small',
} as const

export function PrintPreviewDialog() {
  const job = usePrintStore((s) => s.job)
  const close = usePrintStore((s) => s.close)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const html = useMemo(() => (job ? buildPrintHtml(job) : ''), [job])
  const open = job !== null

  useEffect(() => {
    if (!open || !iframeRef.current) return
    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [html, open])

  const handlePrint = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }

  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className='flex h-[92vh] w-[96vw] max-w-5xl flex-col gap-3 overflow-hidden p-0 sm:rounded-lg'
        showCloseButton={false}
      >
        <DialogHeader className='flex flex-row items-center justify-between gap-3 border-b px-4 py-3 space-y-0'>
          <div className='min-w-0'>
            <DialogTitle className='text-base'>
              {TEMPLATE_LABELS[job.template]} Print Preview
            </DialogTitle>
            <DialogDescription className='text-xs'>
              {job.vouchers.length} voucher
              {job.vouchers.length > 1 ? 's' : ''} · {job.meta.profile} ·{' '}
              {job.meta.validity}
            </DialogDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={handlePrint} className='gap-1.5'>
              <Printer className='size-4' />
              Print
            </Button>
            <Button size='icon' variant='ghost' onClick={close}>
              <X className='size-4' />
            </Button>
          </div>
        </DialogHeader>
        <div className='flex-1 overflow-hidden bg-muted/40'>
          <iframe
            ref={iframeRef}
            title='print-preview'
            className='size-full bg-white'
            sandbox='allow-same-origin allow-modals'
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
