import type { DateRange } from './types/dashboard'

// Backend range is [date_from, date_to) -- date_to EXCLUSIVE (see
// backend/app/modules/dashboard/services/dashboard_service.py
// _resolve_date_range). The DateRangePicker lets the user pick an
// inclusive end date ("show me through Aug 13"), so the exclusive
// `date_to` sent to the API is always the day AFTER the picked end date.
// All arithmetic is done in UTC to match the backend, which computes
// "today" as `datetime.now(timezone.utc).date()` -- never the browser's
// local timezone.

export function nextIsoDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function toExclusiveDateParams(
  range: DateRange,
): { date_from: string; date_to: string } {
  return {
    date_from: range.dateFrom,
    date_to: nextIsoDate(range.dateTo),
  }
}
