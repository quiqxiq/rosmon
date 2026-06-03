import { useEffect, useMemo, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  usePrintStore,
  type PrintJob,
  type PrintTemplate,
} from '../store/print-store'
import { buildPrintHtml } from '../templates/html-builder'

const TEMPLATE_LABELS: Record<PrintTemplate, string> = {
  default: 'Default',
  small: 'Small',
  thermal: 'Thermal',
}

const TEMPLATE_ORDER: PrintTemplate[] = ['default', 'small', 'thermal']

export function PrintPreviewDialog() {
  const job = usePrintStore((s) => s.job)
  const close = usePrintStore((s) => s.close)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Template bisa diganti live di dialog tanpa mengubah job di store.
  // Sinkronisasi dengan job baru dilakukan saat render (pola "adjust state
  // on prop change" React) — bukan di useEffect — agar tidak memicu
  // cascading render / lint react-compiler.
  const [template, setTemplate] = useState<PrintTemplate>('default')
  const [seenJob, setSeenJob] = useState<PrintJob | null>(job)
  if (job !== seenJob) {
    setSeenJob(job)
    setTemplate(job?.template ?? 'default')
  }

  const html = useMemo(
    () => (job ? buildPrintHtml({ ...job, template }) : ''),
    [job, template],
  )
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
            <DialogTitle className='text-base'>Print Preview</DialogTitle>
            <DialogDescription className='text-xs'>
              {job.vouchers.length} voucher
              {job.vouchers.length > 1 ? 's' : ''} · {job.meta.profile} ·{' '}
              {job.meta.validity}
            </DialogDescription>
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex rounded-md border p-0.5'>
              {TEMPLATE_ORDER.map((t) => (
                <Button
                  key={t}
                  type='button'
                  size='sm'
                  variant={template === t ? 'secondary' : 'ghost'}
                  className='h-7 px-2.5 text-xs'
                  onClick={() => setTemplate(t)}
                >
                  {TEMPLATE_LABELS[t]}
                </Button>
              ))}
            </div>
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
