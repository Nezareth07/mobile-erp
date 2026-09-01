// Monetary formatting is centralized in src/lib/money.ts so the whole app
// shows Colombian pesos (COP) consistently. Re-exported here to keep this
// module's public API (formatCurrency) stable for existing callers.
export { formatCurrency } from '../../lib/money'

const dateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}
