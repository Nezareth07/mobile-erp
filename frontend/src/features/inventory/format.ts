// Deliberately duplicated from features/catalog/format.ts / features/dashboard/format.ts
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
