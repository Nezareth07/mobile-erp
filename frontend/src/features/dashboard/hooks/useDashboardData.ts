import { useQuery } from '@tanstack/react-query'
import {
  getDashboardSummary,
  getRecentActivity,
  getSalesOverview,
  getTopCustomers,
  getTopProducts,
} from '../api'
import type { DateRange } from '../types/dashboard'

export function useDashboardSummary(range: DateRange) {
  return useQuery({
    queryKey: ['dashboard', 'summary', range.dateFrom, range.dateTo],
    queryFn: () => getDashboardSummary(range),
  })
}

export function useSalesOverview(range: DateRange) {
  return useQuery({
    queryKey: ['dashboard', 'sales-overview', range.dateFrom, range.dateTo],
    queryFn: () => getSalesOverview(range),
  })
}

export function useTopProducts(range: DateRange) {
  return useQuery({
    queryKey: ['dashboard', 'top-products', range.dateFrom, range.dateTo],
    queryFn: () => getTopProducts(range),
  })
}

export function useTopCustomers(range: DateRange) {
  return useQuery({
    queryKey: ['dashboard', 'top-customers', range.dateFrom, range.dateTo],
    queryFn: () => getTopCustomers(range),
  })
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: () => getRecentActivity(),
  })
}
