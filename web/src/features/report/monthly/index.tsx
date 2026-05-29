import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  ServerOff,
} from 'lucide-react'
import {
  useMonthlyReport,
  useResumeReport,
} from '@/features/voucher/sales/api/queries'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import {
  daysInMonth,
  dateToDailyParam,
  MONTH_NAMES,
} from '../_shared/format'
import { MonthlyBarChart } from './components/monthly-bar-chart'
import { MonthlyDailyTable } from './components/monthly-daily-table'
import { MonthlyExportMenu } from './components/monthly-export-menu'
import { MonthlyPeriodPicker } from './components/monthly-period-picker'
import { MonthlySummaryCards } from './components/monthly-summary-cards'
import { YearlyResumeChart } from './components/yearly-resume-chart'

// Per-day row consumed by the chart + breakdown table. Kept here (not in
// a schema file) because it's a UI-only shape — backend's response is
// less specific (it returns whatever days actually had sales) and we
// densify into 1..daysInMonth below.
export type MonthlyChartRow = {
  date: Date
  count: number
  total: number
}

// Per-month row for the year-overview chart. Mirrors the backend's
// `ResumeReport.monthly[]` shape but with `total` instead of `sum` so
// the existing chart component can stay shape-stable.
export type YearlySummaryRow = {
  month: number
  count: number
  total: number
}

// Densify the backend's daily breakdown to a full month grid. The
// backend may omit zero-count days; the bar chart needs continuous
// 1..N x-axis ticks, so we pre-fill empty rows and merge.
function densifyMonth(
  year: number,
  monthIndex: number,
  daily: Array<{ date: string; count: number; sum: number }>,
): MonthlyChartRow[] {
  const total = daysInMonth(year, monthIndex)
  const rows: MonthlyChartRow[] = []
  for (let day = 1; day <= total; day++) {
    rows.push({
      date: new Date(year, monthIndex, day),
      count: 0,
      total: 0,
    })
  }
  for (const entry of daily) {
    // Backend returns ISO strings (RFC3339). Use local-time components
    // so days don't shift when the browser TZ differs from UTC.
    const dt = new Date(entry.date)
    const day = dt.getDate()
    const row = rows[day - 1]
    if (row) {
      row.count += entry.count
      row.total += entry.sum
    }
  }
  return rows
}

// Pad the backend's resume payload to all 12 months so the year-chart
// always shows a stable 12-tick x-axis even mid-year.
function padYearly(
  rows: Array<{ month: number; count: number; sum: number }>,
): YearlySummaryRow[] {
  const out: YearlySummaryRow[] = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    count: 0,
    total: 0,
  }))
  for (const r of rows) {
    // Backend returns 1-12; convert to 0-11 to match JS Date.
    const idx = r.month - 1
    if (idx >= 0 && idx < 12) {
      out[idx] = { month: idx, count: r.count, total: r.sum }
    }
  }
  return out
}

// Compute the highest-revenue day for the "Best Day" KPI. Backend
// doesn't expose this, so we derive it from the densified rows.
function bestDay(
  rows: MonthlyChartRow[],
): { date: Date | null; total: number } {
  let best: MonthlyChartRow | null = null
  for (const r of rows) {
    if (best === null || r.total > best.total) best = r
  }
  return {
    date: best && best.total > 0 ? best.date : null,
    total: best?.total ?? 0,
  }
}

export function MonthlyReport() {
  const navigate = useNavigate()
  const routerId = useActiveRouterId()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showResume, setShowResume] = useState(true)

  // Backend `month` param is 1-12, JS Date `getMonth()` is 0-11.
  const monthlyQuery = useMonthlyReport(routerId ?? 0, year, month + 1)
  const resumeQuery = useResumeReport(routerId ?? 0, year)

  const rows = useMemo<MonthlyChartRow[]>(
    () => densifyMonth(year, month, monthlyQuery.data?.daily ?? []),
    [year, month, monthlyQuery.data],
  )
  const yearly = useMemo<YearlySummaryRow[]>(
    () => padYearly(resumeQuery.data?.monthly ?? []),
    [resumeQuery.data],
  )
  const best = useMemo(() => bestDay(rows), [rows])

  const drillToDaily = (date: Date) => {
    void navigate({
      to: '/report/daily',
      search: { date: dateToDailyParam(date) },
    })
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its monthly sales
          report.
        </p>
      </Main>
    )
  }

  if (monthlyQuery.isError) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-2 text-center'>
        <p className='text-sm text-destructive'>
          Failed to load monthly report
          {monthlyQuery.error?.message
            ? `: ${monthlyQuery.error.message}`
            : '.'}
        </p>
        <Button
          size='sm'
          variant='outline'
          onClick={() => monthlyQuery.refetch()}
        >
          Retry
        </Button>
      </Main>
    )
  }

  const total = monthlyQuery.data?.total ?? 0
  const count = monthlyQuery.data?.count ?? 0

  // Compute month range for export: first day → last day of selected
  // month. Both endpoints inclusive on the backend.
  const lastDay = daysInMonth(year, month)
  const fromIso = dateToDailyParam(new Date(year, month, 1))
  const toIso = dateToDailyParam(new Date(year, month, lastDay))

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Monthly Report
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {MONTH_NAMES[month]} {year} · daily breakdown and yearly trend
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <MonthlyPeriodPicker
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y)
              setMonth(m)
            }}
          />
          <MonthlyExportMenu
            routerId={routerId}
            year={year}
            month={month}
            from={fromIso}
            to={toIso}
            disabled={monthlyQuery.isLoading || count === 0}
          />
        </div>
      </div>

      {monthlyQuery.isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Loading monthly report…
          </CardContent>
        </Card>
      ) : (
        <>
          <MonthlySummaryCards
            count={count}
            total={total}
            bestDate={best.date}
            bestTotal={best.total}
          />

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>
                {MONTH_NAMES[month]} Revenue by Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBarChart rows={rows} onSelectDay={drillToDaily} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-base'>{year} Year Overview</CardTitle>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 gap-1.5 text-xs'
                onClick={() => setShowResume((v) => !v)}
              >
                {showResume ? (
                  <>
                    <ChevronUp className='size-3.5' />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className='size-3.5' />
                    Show
                  </>
                )}
              </Button>
            </CardHeader>
            {showResume && (
              <CardContent>
                {resumeQuery.isError ? (
                  <p className='py-6 text-center text-xs text-destructive'>
                    Failed to load year overview.
                  </p>
                ) : resumeQuery.isLoading ? (
                  <p className='py-6 text-center text-xs text-muted-foreground'>
                    Loading…
                  </p>
                ) : (
                  <YearlyResumeChart
                    rows={yearly}
                    selectedMonth={month}
                    onSelectMonth={(m) => setMonth(m)}
                  />
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyDailyTable rows={rows} onSelectDay={drillToDaily} />
            </CardContent>
          </Card>
        </>
      )}
    </Main>
  )
}
