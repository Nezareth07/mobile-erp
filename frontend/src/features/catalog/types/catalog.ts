// Mirrors backend/app/modules/product/schemas/{brand,category,product}_*.py.
// Decimal fields (cost_price/sale_price) are strings on the wire, same
// contract already confirmed for the Dashboard/Report modules.

export type TrackingType = 'none' | 'serial' | 'batch'

export interface BrandSummary {
  id: string
  name: string
}

export interface CategorySummary {
  id: string
  name: string
}

export interface Brand {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BrandCreatePayload {
  name: string
}

export type BrandUpdatePayload = Partial<BrandCreatePayload>

export interface Category {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CategoryCreatePayload {
  name: string
}

export type CategoryUpdatePayload = Partial<CategoryCreatePayload>

export interface Product {
  id: string
  name: string
  description: string | null
  sku: string
  tracking_type: TrackingType
  cost_price: string
  sale_price: string
  is_active: boolean
  brand: BrandSummary
  category: CategorySummary
  created_at: string
  updated_at: string
}

export interface ProductCreatePayload {
  name: string
  description: string | null
  sku: string
  brand_id: string
  category_id: string
  tracking_type: TrackingType
  cost_price: string
  sale_price: string
}

export type ProductUpdatePayload = Partial<ProductCreatePayload>
