// Monetary formatting is centralized in src/lib/money.ts so the whole app
// shows Colombian pesos (COP) consistently. Re-exported here to keep this
// module's public API (formatCurrency) stable for existing callers.
export { formatCurrency } from '../../lib/money'

const shortDateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
})

export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(new Date(`${isoDate}T00:00:00`))
}
