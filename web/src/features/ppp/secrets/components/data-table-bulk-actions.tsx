import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'
import { type PPPSecret } from '../api/schema'

type DataTableBulkActionsProps = {
  table: Table<PPPSecret>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const openDialog = useSecretsDialogStore((s) => s.open)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    const ids = selectedRows.map((r) => r.original.id)
    openDialog('multi-delete', undefined, ids)
  }

  return (
    <BulkActionsToolbar table={table} entityName='secret'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='destructive'
            size='icon'
            onClick={handleDelete}
            className='size-8'
            aria-label='Delete selected secrets'
            title='Delete selected secrets'
          >
            <Trash2 />
            <span className='sr-only'>Delete selected secrets</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Delete selected secrets</p>
        </TooltipContent>
      </Tooltip>
    </BulkActionsToolbar>
  )
}
