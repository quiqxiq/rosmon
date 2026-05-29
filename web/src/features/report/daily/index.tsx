import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ServerOff } from 'lucide-react'
import { useDailyReport } from '@/features/voucher/sales/api/queries'
import type {
  SaleFilters,
  VoucherSale,
} from '@/features/voucher/sales/api/schema'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { DailyDatePicker } from './components/daily-date-picker'
import { DailyExportMenu } from './components/daily-export-menu'
import { DailySalesTable } from './components/daily-sales-table'
import { DailySummaryCards } from './components/daily-summary-cards'

// Local UI-state for the table filters. Backend supports the same
// filters as query params, but we apply them client-side: a single day's
// payload is small (<100 rows in practice) and avoiding a refetch per
// keystroke keeps the UX snappy without a debounce hop.
type DailyFiltersState = {
  search: string
  profile: string
  server: string
}

const EMPTY_FILTERS: DailyFiltersState = {
  search: '',
  profile: 'all',
  server: 'all',
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDateParam(value: unknown): Date {
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed)
  }
  return startOfDay(new Date())
}

// Backend `/reports/daily` expects YYYY-MM-DD. Format the local date
// without going through ISO/UTC so a date picked in Asia/Jakarta doesn't
// roll back a day on the URL/query.
function dateToParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function applyDailyFilters(
  sales: VoucherSale[],
  filters: DailyFiltersState,
): VoucherSale[] {
  const term = filters.search.trim().toLowerCase()
  return sales.filter((s) => {
    if (filters.profile !== 'all' && s.profile_name !== filters.profile) {
      return false
    }
    if (filters.server !== 'all' && s.server !== filters.server) {
      return false
    }
    if (term) {
      const haystack = [
        s.username,
        s.profile_name,
        s.mac_address,
        s.ip_address,
        s.server,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
}

export function DailyReport() {
  const navigate = useNavigate()
  const routerId = useActiveRouterId()

  const [date, setDate] = useState<Date>(() => {
    if (typeof window === 'undefined') return startOfDay(new Date())
    const params = new URLSearchParams(window.location.search)
    return parseDateParam(params.get('date'))
  })
  const [filters, setFilters] = useState<DailyFiltersState>(EMPTY_FILTERS)

  const dateIso = dateToParam(date)
  // Filters are applied client-side, so we DO NOT pass them to the API
  // hook — passing would re-key the cache per filter and trigger refetch
  // loops as the user types. Backend filter params remain unused.
  const apiFilters: SaleFilters | undefined = undefined
  const reportQuery = useDailyReport(routerId ?? 0, dateIso, apiFilters)

  // Stabilise the sales array reference so the downstream useMemo
  // doesn't recompute on every render due to a fresh `[]` literal.
  const sales = useMemo(
    () => reportQuery.data?.sales ?? [],
    [reportQuery.data],
  )
  const filtered = useMemo(
    () => applyDailyFilters(sales, filters),
    [sales, filters],
  )
  const filteredTotal = filtered.reduce((sum, s) => sum + s.selling_price, 0)

  const handleDateChange = (next: Date) => {
    const start = startOfDay(next)
    setDate(start)
    void navigate({
      to: '/report/daily',
      search: { date: dateToParam(start) },
      replace: true,
    })
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its daily sales
          report.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Daily Report
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Voucher sales detail for the selected date
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <DailyDatePicker date={date} onChange={handleDateChange} />
          <DailyExportMenu
            routerId={routerId}
            date={dateIso}
            disabled={reportQuery.isLoading || sales.length === 0}
          />
        </div>
      </div>

      {reportQuery.isError ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
            <p className='text-sm text-destructive'>
              Failed to load daily report
              {reportQuery.error?.message
                ? `: ${reportQuery.error.message}`
                : '.'}
            </p>
            <Button
              size='sm'
              variant='outline'
              onClick={() => reportQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : reportQuery.isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Loading daily report…
          </CardContent>
        </Card>
      ) : (
        <>
          <DailySummaryCards
            total={reportQuery.data?.total ?? 0}
            count={reportQuery.data?.count ?? 0}
            filteredCount={filtered.length}
            filteredTotal={filteredTotal}
          />

          <Card>
            <CardHeader className='pb-2'>
              <h3 className='font-semibold'>Sales Detail</h3>
            </CardHeader>
            <CardContent>
              <DailySalesTable
                sales={sales}
                filteredSales={filtered}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </CardContent>
          </Card>
        </>
      )}
    </Main>
  )
}
