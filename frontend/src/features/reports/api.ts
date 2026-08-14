import { api } from '../../lib/api'
import { toExclusiveDateParams } from './dateRange'
import type {
  DailyPurchasesPoint,
  DailySalesPoint,
  DateRange,
  PurchasesSummary,
  PurchasesTopProductsOrderBy,
  SalesSummaryReport,
  SalesTopProductsOrderBy,
  TopCustomer,
  TopPurchasedProduct,
  TopSellingProduct,
  TopSupplier,
} from './types/reports'

// Matches the `limit` default already used server-side for every
// top-N endpoint (Query(default=10, ...) in report_router.py) -- no UI
// control to change it, same call already made for Dashboard's top
// lists (F4).
const TOP_LIST_LIMIT = 10

export async function getSalesSummary(
  range: DateRange,
): Promise<SalesSummaryReport> {
  const response = await api.get<SalesSummaryReport>('/reports/sales/summary', {
    params: toExclusiveDateParams(range),
  })
  return response.data
}

export async function getSalesTimeseries(
  range: DateRange,
): Promise<DailySalesPoint[]> {
  const response = await api.get<DailySalesPoint[]>(
    '/reports/sales/timeseries',
    { params: toExclusiveDateParams(range) },
  )
  return response.data
}

export async function getSalesTopProducts(
  range: DateRange,
  orderBy: SalesTopProductsOrderBy,
): Promise<TopSellingProduct[]> {
  const response = await api.get<TopSellingProduct[]>(
    '/reports/sales/top-products',
    {
      params: {
        ...toExclusiveDateParams(range),
        limit: TOP_LIST_LIMIT,
        order_by: orderBy,
      },
    },
  )
  return response.data
}

export async function getSalesTopCustomers(
  range: DateRange,
): Promise<TopCustomer[]> {
  const response = await api.get<TopCustomer[]>(
    '/reports/sales/top-customers',
    { params: { ...toExclusiveDateParams(range), limit: TOP_LIST_LIMIT } },
  )
  return response.data
}

export async function getPurchasesSummary(
  range: DateRange,
): Promise<PurchasesSummary> {
  const response = await api.get<PurchasesSummary>(
    '/reports/purchases/summary',
    { params: toExclusiveDateParams(range) },
  )
  return response.data
}

export async function getPurchasesTimeseries(
  range: DateRange,
): Promise<DailyPurchasesPoint[]> {
  const response = await api.get<DailyPurchasesPoint[]>(
    '/reports/purchases/timeseries',
    { params: toExclusiveDateParams(range) },
  )
  return response.data
}

export async function getPurchasesTopSuppliers(
  range: DateRange,
): Promise<TopSupplier[]> {
  const response = await api.get<TopSupplier[]>(
    '/reports/purchases/top-suppliers',
    { params: { ...toExclusiveDateParams(range), limit: TOP_LIST_LIMIT } },
  )
  return response.data
}

export async function getPurchasesTopProducts(
  range: DateRange,
  orderBy: PurchasesTopProductsOrderBy,
): Promise<TopPurchasedProduct[]> {
  const response = await api.get<TopPurchasedProduct[]>(
    '/reports/purchases/top-products',
    {
      params: {
        ...toExclusiveDateParams(range),
        limit: TOP_LIST_LIMIT,
        order_by: orderBy,
      },
    },
  )
  return response.data
}
