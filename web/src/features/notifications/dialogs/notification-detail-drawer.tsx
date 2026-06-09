import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/format'
import { statusVariant } from '../components/columns'
import { useNotificationDialogStore } from '../store/dialog-store'
import { type NotificationLog } from '../api/schema'

export function NotificationDetailDrawer() {
  const { target, close } = useNotificationDialogStore()
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && close()}>
      {target && <Detail log={target} />}
    </Sheet>
  )
}

function Detail({ log }: { log: NotificationLog }) {
  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle className='flex items-center gap-2'>
          <span className='font-mono text-sm'>{log.template_slug}</span>
          <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
        </SheetTitle>
        <SheetDescription>
          To {log.recipient_phone} ·{' '}
          {formatDateTime(new Date(log.created_at))}
        </SheetDescription>
      </SheetHeader>

      <div className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'>
        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Message
          </Label>
          <div className='whitespace-pre-wrap rounded-md bg-muted p-3 text-sm'>
            {log.message_body || '—'}
          </div>
        </div>

        <dl className='grid grid-cols-2 gap-3 text-sm'>
          <div>
            <dt className='text-xs text-muted-foreground'>Provider</dt>
            <dd>{log.provider || '—'}</dd>
          </div>
          <div>
            <dt className='text-xs text-muted-foreground'>Retries</dt>
            <dd className='tabular-nums'>{log.retry_count}</dd>
          </div>
          <div>
            <dt className='text-xs text-muted-foreground'>Sent at</dt>
            <dd>
              {log.sent_at ? formatDateTime(new Date(log.sent_at)) : '—'}
            </dd>
          </div>
          <div>
            <dt className='text-xs text-muted-foreground'>Next retry</dt>
            <dd>
              {log.next_retry_at
                ? formatDateTime(new Date(log.next_retry_at))
                : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </SheetContent>
  )
}
