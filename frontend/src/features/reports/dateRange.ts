// Duplicated from features/dashboard/dateRange.ts (closed phase F4) and
// features/inventory/dateRange.ts (closed phase F7) rather than shared --
// same per-feature isolation precedent (see features/reports/errors.ts).
// Backend range is [date_from, date_to) -- date_to EXCLUSIVE (see
// backend/app/modules/report/services/report_service.py
// _resolve_date_range, identical to Dashboard's). The picker lets the
// user choose an inclusive end date; the exclusive date_to sent to the
// API is always the day after the picked end date. All arithmetic is
// done in UTC to match the backend's `date.today()` semantics.

import type { DateRange } from './types/reports'

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
