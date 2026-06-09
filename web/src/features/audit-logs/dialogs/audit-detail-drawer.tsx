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
import { useAuditLogDialogStore } from '../store/dialog-store'
import { type AuditLog } from '../api/schema'

// Pretty-print a JSON string; fall back to the raw string if not parseable.
function pretty(raw: string): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function AuditDetailDrawer() {
  const { target, close } = useAuditLogDialogStore()
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && close()}>
      {target && <Detail log={target} />}
    </Sheet>
  )
}

function Detail({ log }: { log: AuditLog }) {
  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'>
      <SheetHeader className='border-b'>
        <SheetTitle className='flex items-center gap-2'>
          <Badge variant='outline' className='font-mono text-xs'>
            {log.action}
          </Badge>
          <span className='text-sm font-normal text-muted-foreground'>
            {log.entity_type}
            {log.entity_id ? ` #${log.entity_id}` : ''}
          </span>
        </SheetTitle>
        <SheetDescription>
          {formatDateTime(new Date(log.created_at))} ·{' '}
          {log.user_id ? `user #${log.user_id}` : 'system'}
          {log.ip_address ? ` · ${log.ip_address}` : ''}
        </SheetDescription>
      </SheetHeader>

      <div className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'>
        {log.notes ? (
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>
              Notes
            </Label>
            <p className='text-sm'>{log.notes}</p>
          </div>
        ) : null}

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Old values
          </Label>
          <pre className='overflow-x-auto rounded-md bg-muted p-3 text-xs'>
            {pretty(log.old_values ?? '')}
          </pre>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            New values
          </Label>
          <pre className='overflow-x-auto rounded-md bg-muted p-3 text-xs'>
            {pretty(log.new_values ?? '')}
          </pre>
        </div>
      </div>
    </SheetContent>
  )
}
