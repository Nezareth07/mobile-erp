import { useQuery } from '@tanstack/react-query'
import {
  getPurchasesSummary,
  getPurchasesTimeseries,
  getPurchasesTopProducts,
  getPurchasesTopSuppliers,
  getSalesSummary,
  getSalesTimeseries,
  getSalesTopCustomers,
  getSalesTopProducts,
} from '../api'
import type {
  DateRange,
  PurchasesTopProductsOrderBy,
  SalesTopProductsOrderBy,
} from '../types/reports'

export function useSalesSummary(range: DateRange) {
  return useQuery({
    queryKey: ['reports', 'sales', 'summary', range.dateFrom, range.dateTo],
    queryFn: () => getSalesSummary(range),
  })
}

export function useSalesTimeseries(range: DateRange) {
  return useQuery({
    queryKey: [
      'reports',
      'sales',
      'timeseries',
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () => getSalesTimeseries(range),
  })
}

export function useSalesTopProducts(
  range: DateRange,
  orderBy: SalesTopProductsOrderBy,
) {
  return useQuery({
    queryKey: [
      'reports',
      'sales',
      'top-products',
      range.dateFrom,
      range.dateTo,
      orderBy,
    ],
    queryFn: () => getSalesTopProducts(range, orderBy),
  })
}

export function useSalesTopCustomers(range: DateRange) {
  return useQuery({
    queryKey: [
      'reports',
      'sales',
      'top-customers',
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () => getSalesTopCustomers(range),
  })
}

export function usePurchasesSummary(range: DateRange) {
  return useQuery({
    queryKey: [
      'reports',
      'purchases',
      'summary',
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () => getPurchasesSummary(range),
  })
}

export function usePurchasesTimeseries(range: DateRange) {
  return useQuery({
    queryKey: [
      'reports',
      'purchases',
      'timeseries',
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () => getPurchasesTimeseries(range),
  })
}

export function usePurchasesTopSuppliers(range: DateRange) {
  return useQuery({
    queryKey: [
      'reports',
      'purchases',
      'top-suppliers',
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () => getPurchasesTopSuppliers(range),
  })
}

export function usePurchasesTopProducts(
  range: DateRange,
  orderBy: PurchasesTopProductsOrderBy,
) {
  return useQuery({
    queryKey: [
      'reports',
      'purchases',
      'top-products',
      range.dateFrom,
      range.dateTo,
      orderBy,
    ],
    queryFn: () => getPurchasesTopProducts(range, orderBy),
  })
}
