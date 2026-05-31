// TODO: Backend belum mengimplementasikan endpoint tiket dukungan.
// Data di bawah ini adalah MOCK dan harus diganti dengan API call nyata
// ketika backend endpoint tersedia (kemungkinan Fase 4/5).
// Endpoint yang dibutuhkan: GET/POST /customer/tickets, GET/POST /customer/tickets/:id/replies

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PortalHeader } from '../_shared/portal-header'

type TicketStatus = 'open' | 'in_progress' | 'resolved'

interface MockTicket {
  id: number
  code: string
  title: string
  preview: string
  status: TicketStatus
  createdAt: string
  replyCount: number
}

// MOCK DATA — replace with real API when backend implements ticket endpoints
const MOCK_TICKETS: MockTicket[] = [
  {
    id: 1,
    code: 'TKT-001',
    title: 'Koneksi internet lambat di sore hari',
    preview: 'Setiap sore sekitar jam 4-8 malam, koneksi internet saya sangat lambat...',
    status: 'in_progress',
    createdAt: '3 Jun 2026',
    replyCount: 2,
  },
  {
    id: 2,
    code: 'TKT-002',
    title: 'Router tidak bisa connect',
    preview: 'Router saya tidak bisa terkoneksi ke internet sejak tadi pagi...',
    status: 'resolved',
    createdAt: '28 Mei 2026',
    replyCount: 5,
  },
]

const statusMap: Record<TicketStatus, { label: string; variant: 'idle' | 'default' | 'online' | 'offline' }> = {
  open: { label: 'Menunggu', variant: 'idle' },
  in_progress: { label: 'Diproses', variant: 'default' },
  resolved: { label: 'Selesai', variant: 'online' },
}

type FilterValue = 'all' | 'open' | 'resolved'

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Terbuka', value: 'open' },
  { label: 'Selesai', value: 'resolved' },
]

export function PortalTickets() {
  const [filter, setFilter] = useState<FilterValue>('all')

  const displayed = MOCK_TICKETS.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'open') return t.status !== 'resolved'
    return t.status === 'resolved'
  })

  return (
    <div>
      <PortalHeader title='Tiket Dukungan' />

      {/* Backend TODO notice */}
      <div className='mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'>
        ⚠️ Fitur tiket dukungan sedang dalam pengembangan. Data di bawah adalah contoh.
      </div>

      {/* Filter chips */}
      <div className='flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide'>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className='space-y-2 px-4 pb-4'>
        {displayed.length === 0 ? (
          <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <MessageCircle className='size-10 text-muted-foreground/40' />
            <p className='font-medium'>Tidak ada tiket</p>
          </div>
        ) : (
          displayed.map((ticket) => {
            const st = statusMap[ticket.status]
            return (
              <div
                key={ticket.id}
                className='rounded-xl border bg-card p-4 space-y-2'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-mono text-xs text-muted-foreground'>
                    {ticket.code}
                  </span>
                  <Badge variant={st.variant} className='text-xs'>
                    {st.label}
                  </Badge>
                </div>
                <p className='font-medium leading-snug'>{ticket.title}</p>
                <p className='line-clamp-2 text-sm text-muted-foreground'>
                  {ticket.preview}
                </p>
                <div className='flex items-center justify-between text-xs text-muted-foreground'>
                  <span>{ticket.createdAt}</span>
                  <span>{ticket.replyCount} balasan</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
