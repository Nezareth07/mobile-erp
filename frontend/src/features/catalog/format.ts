// Deliberately duplicated from features/dashboard/format.ts rather than
// shared: F4 is a closed, committed phase and the working rule is not to
// modify a closed phase without a real blocking bug -- moving this into a
// shared module would mean editing F4's files for a non-bug reason.
const currencyFormatter = new Intl.NumberFormat('es-419', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value))
}
