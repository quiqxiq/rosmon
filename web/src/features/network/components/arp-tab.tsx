import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableColumnHeader, SimpleDataTable } from '@/components/data-table'
import { useArpByMac } from '../api/queries'
import { type ARPEntry } from '../api/schema'

const columns: ColumnDef<ARPEntry, unknown>[] = [
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
    accessorKey: 'interface',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Interface' />
    ),
    cell: ({ row }) => <span>{row.original.interface || '—'}</span>,
  },
  {
    id: 'dynamic',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant={row.original.dynamic ? 'offline' : 'online'}>
        {row.original.dynamic ? 'dynamic' : 'static'}
      </Badge>
    ),
  },
]

// ARP lookup is by-MAC only (backend requires the `mac` query param), so
// this tab is a search box rather than a full list.
export function ArpTab() {
  const routerId = useActiveRouterId() ?? 0
  const [input, setInput] = useState('')
  const [mac, setMac] = useState('')
  const arpQuery = useArpByMac(routerId, mac)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setMac(input.trim())
  }

  return (
    <div className='flex flex-col gap-4'>
      <form onSubmit={handleSearch} className='flex gap-2'>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder='AA:BB:CC:DD:EE:FF'
          className='max-w-xs font-mono'
        />
        <Button type='submit' size='sm' className='gap-1.5'>
          <Search className='size-4' />
          Look up
        </Button>
      </form>
      {mac ? (
        <SimpleDataTable
          columns={columns}
          data={arpQuery.data ?? []}
          emptyMessage={
            arpQuery.isFetching ? 'Searching…' : 'No ARP entries for that MAC.'
          }
        />
      ) : (
        <p className='text-sm text-muted-foreground'>
          Enter a MAC address to look up its ARP entry.
        </p>
      )}
    </div>
  )
}
