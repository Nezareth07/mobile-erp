// Mirrors backend/app/modules/report/schemas/* and the schemas it
// references (sale, purchase, product, customer, supplier). Decimal
// fields are strings on the wire -- same convention already confirmed
// for Dashboard (F4) and Inventory (F7) against backend/test/integration/
// test_reports.py, which asserts `Decimal(body["profit_margin"])` on a
// JSON string.

export interface ProductSummary {
  id: string
  name: string
  sku: string
}

export interface CustomerSummary {
  id: string
  name: string
}

export interface SupplierSummary {
  id: string
  name: string
}

export interface SalesSummaryReport {
  sales_count: number
  total_amount: string
  total_cost: string
  total_profit: string
  // null when total_amount is 0 -- see report_service._profit_margin.
  profit_margin: string | null
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

export interface PurchasesSummary {
  purchases_count: number
  total_cost: string
}

export interface DailyPurchasesPoint {
  date: string
  purchases_count: number
  total_cost: string
}

export interface TopSupplier {
  supplier: SupplierSummary
  purchases_count: number
  total_cost: string
}

export interface TopPurchasedProduct {
  product: ProductSummary
  quantity_purchased: number
  total_cost: string
}

// Matches the `pattern` constraint on each endpoint's `order_by` Query
// param in report_router.py -- sales and purchases top-products accept
// different vocabularies, never mix them in the UI.
export type SalesTopProductsOrderBy = 'revenue' | 'quantity'
export type PurchasesTopProductsOrderBy = 'cost' | 'quantity'

export interface DateRange {
  dateFrom: string
  dateTo: string
}
