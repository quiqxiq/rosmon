import { useEffect, useMemo, useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { CloudDownload, Plus, ServerOff } from 'lucide-react'
import { useSalesList } from '@/features/voucher/sales/api/queries'
import type {
  SalesListParams,
  VoucherSale,
} from '@/features/voucher/sales/api/schema'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SalesDetailDialog } from './components/sales-detail-dialog'
import { SalesExportMenu } from './components/sales-export-menu'
import { SalesFiltersBar } from './components/sales-filters-bar'
import {
  PAGE_SIZE_OPTIONS,
  SalesPagination,
} from './components/sales-pagination'
import { SalesRangePicker } from './components/sales-range-picker'
import { SalesSummary } from './components/sales-summary'
import { SalesTable } from './components/sales-table'
import { SalesDialogs } from './dialogs/sales-dialogs'
import { useSalesDialogStore } from './store/sales-dialog-store'

// `getRouteApi` is the typed accessor for the route's `validateSearch`
// output. Going through it (rather than `useNavigate`'s untyped search
// param) keeps URL-state changes in sync with the schema in `routes/`.
const route = getRouteApi('/_authenticated/voucher/sales')

const DEFAULT_PAGE_SIZE = 25

// Format a JS Date as YYYY-MM-DD using LOCAL date components — same
// reasoning as elsewhere in the project: a date picked in Asia/Jakarta
// shouldn't shift back a day when serialised to the URL.
function dateToYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Parse YYYY-MM-DD → local-midnight Date. Falls back to `today` for
// malformed inputs so a stray URL param doesn't crash the page.
function ymdToDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return fallback
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

export function VoucherSales() {
  const navigate = useNavigate()
  const search = route.useSearch()
  const routerId = useActiveRouterId()
  const openDialog = useSalesDialogStore((s) => s.open)

  // Default range = last 7 days inclusive (today + 6 days back). Falls
  // out of the URL params when present, otherwise computed once.
  const today = startOfDay(new Date())
  const initialFrom = ymdToDate(search.from, addDays(today, -6))
  const initialTo = ymdToDate(search.to, today)

  const [from, setFrom] = useState<Date>(initialFrom)
  const [to, setTo] = useState<Date>(initialTo)
  const [page, setPage] = useState<number>(search.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(
    PAGE_SIZE_OPTIONS.includes(
      (search.page_size ?? DEFAULT_PAGE_SIZE) as 25 | 50 | 100,
    )
      ? // Fallback ke DEFAULT_PAGE_SIZE saat page_size tidak ada di URL —
        // tanpa ini pageSize bisa undefined → "Page 1 of NaN".
        ((search.page_size ?? DEFAULT_PAGE_SIZE) as number)
      : DEFAULT_PAGE_SIZE,
  )

  // Filters — kept controlled and debounced for search. Profile/server
  // values use the sentinel string 'all' for the "no filter" state so
  // shadcn's `<Select>` (which can't have an empty option value) works.
  const [search_, setSearch_] = useState<string>(search.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(
    search.search ?? '',
  )
  const [profile, setProfile] = useState<string>(search.profile ?? 'all')
  const [server, setServer] = useState<string>(search.server ?? 'all')
  const [selectedSale, setSelectedSale] = useState<VoucherSale | null>(null)

  // Debounce search by 300ms so fast typers don't burn a refetch per
  // keystroke. The visible input updates immediately; the API hook
  // keys off `debouncedSearch`.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search_), 300)
    return () => clearTimeout(t)
  }, [search_])

  // Reset to page 1 when any filter changes — common UX expectation,
  // and prevents the user from landing on an empty page 7 just because
  // the filtered set only has 12 rows. Uses the React 19 "derive state
  // during render" pattern: store the prior filter signature in state
  // and compare. This avoids the cascading-render warning we'd get
  // from doing the reset inside useEffect.
  const filterKey = `${debouncedSearch}|${profile}|${server}|${dateToYmd(from)}|${dateToYmd(to)}|${pageSize}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  // Sync local state → URL params with `replace: true` so back-button
  // history isn't polluted by every keystroke.
  useEffect(() => {
    void navigate({
      to: '/voucher/sales',
      search: (prev) => ({
        ...prev,
        from: dateToYmd(from),
        to: dateToYmd(to),
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        profile: profile === 'all' ? undefined : profile,
        server: server === 'all' ? undefined : server,
      }),
      replace: true,
    })
    // navigate is referentially stable; intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, page, pageSize, debouncedSearch, profile, server])

  const params: SalesListParams = useMemo(
    () => ({
      from: dateToYmd(from),
      to: dateToYmd(to),
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      profile: profile === 'all' ? undefined : profile,
      server: server === 'all' ? undefined : server,
    }),
    [from, to, page, pageSize, debouncedSearch, profile, server],
  )

  const listQuery = useSalesList(routerId ?? 0, params)

  // Memoize the items array to keep the reference stable across renders
  // when the query data hasn't changed. The `?? []` fallback otherwise
  // creates a fresh array every render, which would re-trigger every
  // downstream useMemo that depends on it.
  const items = useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data?.items],
  )
  const total = listQuery.data?.total ?? 0
  const totalRevenue = listQuery.data?.total_revenue ?? 0

  // Build distinct option lists from the current page. Good enough for
  // mock data; once Phase 7 lands a `/profiles` endpoint we'll source
  // these from there.
  const profileOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of items) if (s.profile_name) set.add(s.profile_name)
    // Always include the currently-active filter even if no row matches
    // it — otherwise the `<Select>` shows a blank value.
    if (profile !== 'all') set.add(profile)
    return Array.from(set).sort()
  }, [items, profile])

  const serverOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of items) if (s.server) set.add(s.server)
    if (server !== 'all') set.add(server)
    return Array.from(set).sort()
  }, [items, server])

  const handleReset = () => {
    setSearch_('')
    setProfile('all')
    setServer('all')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its voucher sales
          history.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Sales History
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Voucher sales over the selected range
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <SalesRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(startOfDay(f))
              setTo(startOfDay(t))
            }}
            disabled={listQuery.isLoading}
          />
          <Button
            size='sm'
            className='h-8 gap-1.5'
            onClick={() => openDialog('record')}
          >
            <Plus className='size-3.5' />
            Record Sale
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='h-8 gap-1.5'
            onClick={() => openDialog('import')}
          >
            <CloudDownload className='size-3.5' />
            Import
          </Button>
          <SalesExportMenu
            routerId={routerId}
            from={dateToYmd(from)}
            to={dateToYmd(to)}
            filters={{
              search: debouncedSearch || undefined,
              profile: profile === 'all' ? undefined : profile,
              server: server === 'all' ? undefined : server,
            }}
            disabled={listQuery.isLoading || total === 0}
          />
        </div>
      </div>

      <SalesSummary
        count={total}
        revenue={totalRevenue}
        loading={listQuery.isLoading}
      />

      <SalesFiltersBar
        search={search_}
        onSearchChange={setSearch_}
        profile={profile}
        onProfileChange={setProfile}
        server={server}
        onServerChange={setServer}
        profileOptions={profileOptions}
        serverOptions={serverOptions}
        onReset={handleReset}
        disabled={listQuery.isLoading}
      />

      <SalesTable
        sales={items}
        loading={listQuery.isLoading || listQuery.isFetching}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        onSelectSale={setSelectedSale}
      />

      <SalesPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        disabled={listQuery.isLoading}
      />

      <SalesDetailDialog
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
      <SalesDialogs />
    </Main>
  )
}
