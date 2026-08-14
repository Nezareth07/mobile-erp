// Deliberately duplicated from features/dashboard/format.ts / features/
// inventory/format.ts rather than shared -- both are closed, committed
// phases and the working rule is not to modify a closed phase without a
// real blocking bug.

const currencyFormatter = new Intl.NumberFormat('es-419', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('es-419', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

const shortDateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
})

export function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value))
}

// profit_margin is already a percentage value (e.g. "60.00" means 60%),
// not a 0-1 fraction -- see report_service._profit_margin, which
// multiplies by 100 before returning.
export function formatPercent(value: string | number): string {
  return `${percentFormatter.format(Number(value))}%`
}

export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(new Date(`${isoDate}T00:00:00`))
}
