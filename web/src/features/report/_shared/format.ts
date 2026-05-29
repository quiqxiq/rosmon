// Shared report formatting helpers. Lives outside daily/monthly so the
// upcoming Step 9 cleanup can drop the per-page `data/data.ts` files
// without orphaning these constants.

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

// Format a JS Date into the YYYY-MM-DD string the daily report endpoint
// (and the `?date=` URL param) expect. Uses local-time components so a
// date picked in Asia/Jakarta doesn't roll back across the UTC boundary.
export function dateToDailyParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Number of calendar days in the given (year, monthIndex) tuple.
// `month` is 0-based to match the JS Date convention used everywhere
// else in this app.
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
