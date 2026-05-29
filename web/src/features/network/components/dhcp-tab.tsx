import { type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader, SimpleDataTable } from '@/components/data-table'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { parseAPIError } from '@/lib/api/errors'
import { useDHCPLeases, useDeleteDHCPLease } from '../api/queries'
import { type DHCPLease } from '../api/schema'

export function DhcpTab() {
  const routerId = useActiveRouterId() ?? 0
  const leasesQuery = useDHCPLeases(routerId)
  const deleteMutation = useDeleteDHCPLease(routerId)

  const columns: ColumnDef<DHCPLease, unknown>[] = [
    {
      accessorKey: 'address',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Address' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.original.address || '—'}</span>
      ),
    },
    {
      accessorKey: 'mac_address',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='MAC' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.mac_address || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'host_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Host' />
      ),
      cell: ({ row }) => <span>{row.original.host_name || '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'bound' ? 'online' : 'offline'}>
          {row.original.status || 'unknown'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ConfirmDeleteButton
          title='Remove DHCP lease?'
          description={`Lease for ${row.original.address || row.original.mac_address} will be removed.`}
          pending={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(row.original.id)
              toast.success('Lease removed')
            } catch (err) {
              toast.error('Failed to remove lease', {
                description: parseAPIError(err),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <SimpleDataTable
      columns={columns}
      data={leasesQuery.data ?? []}
      searchKey='address'
      searchPlaceholder='Search by address...'
      emptyMessage='No DHCP leases.'
    />
  )
}
