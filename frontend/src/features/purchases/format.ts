// Deliberately duplicated from features/catalog/format.ts and friends
// rather than shared -- both are closed, committed phases and the working
// rule is not to modify a closed phase without a real blocking bug.
const currencyFormatter = new Intl.NumberFormat('es-419', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value))
}

const dateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}
