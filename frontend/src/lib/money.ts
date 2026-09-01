// Centralized monetary presentation for the whole frontend.
//
// MobileERP operates in Colombian pesos (COP). The backend stores and
// returns the numeric amounts already in pesos -- this helper is purely
// presentational and performs NO currency conversion.
//
// COP amounts are whole pesos in practice, so no decimal places are
// shown. Intl.NumberFormat('es-CO', ...) produces the Colombian grouping
// ("." as thousands separator) and a "$" symbol, e.g. 1700000 -> "$ 1.700.000".
const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value))
}
