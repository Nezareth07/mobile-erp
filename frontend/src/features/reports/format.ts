// Monetary formatting is centralized in src/lib/money.ts so the whole app
// shows Colombian pesos (COP) consistently. Re-exported here to keep this
// module's public API (formatCurrency) stable for existing callers.
export { formatCurrency } from '../../lib/money'

const percentFormatter = new Intl.NumberFormat('es-419', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

const shortDateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
})

// profit_margin is already a percentage value (e.g. "60.00" means 60%),
// not a 0-1 fraction -- see report_service._profit_margin, which
// multiplies by 100 before returning.
export function formatPercent(value: string | number): string {
  return `${percentFormatter.format(Number(value))}%`
}

export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(new Date(`${isoDate}T00:00:00`))
}
