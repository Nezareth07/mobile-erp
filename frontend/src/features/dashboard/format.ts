const currencyFormatter = new Intl.NumberFormat('es-419', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const shortDateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
})

export function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value))
}

export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(new Date(`${isoDate}T00:00:00`))
}
