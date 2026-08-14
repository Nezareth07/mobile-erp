import type { DateRange } from '../dateRange'

// Duplicated from features/dashboard/components/DateRangePicker.tsx (closed
// phase F4) rather than shared -- see dateRange.ts for the same
// per-feature isolation precedent.
export interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const inputClasses =
  'rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2'

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="inventory-date-from">
        Desde
      </label>
      <input
        id="inventory-date-from"
        type="date"
        value={value.dateFrom}
        max={value.dateTo}
        onChange={(event) =>
          onChange({ ...value, dateFrom: event.target.value })
        }
        className={inputClasses}
      />
      <span className="text-sm text-ink-muted">a</span>
      <label className="sr-only" htmlFor="inventory-date-to">
        Hasta
      </label>
      <input
        id="inventory-date-to"
        type="date"
        value={value.dateTo}
        min={value.dateFrom}
        onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
        className={inputClasses}
      />
    </div>
  )
}
