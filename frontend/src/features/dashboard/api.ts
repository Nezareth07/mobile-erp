import { api } from '../../lib/api'
import { toExclusiveDateParams } from './dateRange'
import type {
  DailySalesPoint,
  DashboardSummaryResponse,
  DateRange,
  RecentActivityItem,
  TopCustomer,
  TopSellingProduct,
} from './types/dashboard'

export async function getDashboardSummary(
  range: DateRange,
): Promise<DashboardSummaryResponse> {
  const response = await api.get<DashboardSummaryResponse>(
    '/dashboard/summary',
    { params: toExclusiveDateParams(range) },
  )
  return response.data
}

export async function getSalesOverview(
  range: DateRange,
): Promise<DailySalesPoint[]> {
  const response = await api.get<DailySalesPoint[]>(
    '/dashboard/sales-overview',
    { params: toExclusiveDateParams(range) },
  )
  return response.data
}

export async function getTopProducts(
  range: DateRange,
): Promise<TopSellingProduct[]> {
  const response = await api.get<TopSellingProduct[]>(
    '/dashboard/top-products',
    { params: { ...toExclusiveDateParams(range), order_by: 'revenue' } },
  )
  return response.data
}

export async function getTopCustomers(
  range: DateRange,
): Promise<TopCustomer[]> {
  const response = await api.get<TopCustomer[]>('/dashboard/top-customers', {
    params: toExclusiveDateParams(range),
  })
  return response.data
}

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const response = await api.get<RecentActivityItem[]>(
    '/dashboard/recent-activity',
  )
  return response.data
}
