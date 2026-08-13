// Mirrors backend/app/modules/dashboard/schemas/* and the schemas it
// references (sale, purchase, inventory, product, customer). Decimal
// fields are strings on the wire -- confirmed against
// backend/test/integration/test_dashboard.py, which asserts
// `isinstance(total_amount_raw, str)`.

export type LocationType = 'store' | 'warehouse' | 'online'

export type MovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out'
  | 'warranty_out'
  | 'warranty_in'
  | 'transfer_in'
  | 'transfer_out'

export type MovementSourceType =
  | 'manual'
  | 'purchase'
  | 'sale'
  | 'warranty'
  | 'transfer'

export interface ProductSummary {
  id: string
  name: string
  sku: string
}

export interface CustomerSummary {
  id: string
  name: string
}

export interface LocationSummary {
  id: string
  name: string
  type: LocationType
}

export interface SalesSummary {
  sales_count: number
  total_amount: string
  total_cost: string
  total_profit: string
}

export interface PurchasesSummary {
  purchases_count: number
  total_cost: string
}

export interface DashboardSummaryResponse {
  sales_today: SalesSummary
  sales_period: SalesSummary
  purchases_period: PurchasesSummary
  period_date_from: string
  period_date_to: string
  active_customers_count: number
  active_products_count: number
  active_suppliers_count: number
}

export interface DailySalesPoint {
  date: string
  sales_count: number
  revenue: string
  cost: string
  profit: string
}

export interface TopSellingProduct {
  product: ProductSummary
  quantity_sold: number
  revenue: string
}

export interface TopCustomer {
  customer: CustomerSummary
  sales_count: number
  revenue: string
}

export interface RecentActivityItem {
  id: string
  product: ProductSummary
  movement_type: MovementType
  quantity: number | null
  unit_cost: string
  location: LocationSummary
  source_type: MovementSourceType
  source_reference: string | null
  notes: string | null
  created_at: string
}

export interface DateRange {
  dateFrom: string
  dateTo: string
}
