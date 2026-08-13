import { api } from '../../lib/api'
import type {
  Brand,
  BrandCreatePayload,
  BrandUpdatePayload,
  Category,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
} from './types/catalog'
import type { SimpleEntityApi } from './types/simpleEntity'

// --- brands ---------------------------------------------------------------

export async function listBrands(): Promise<Brand[]> {
  const response = await api.get<Brand[]>('/brands')
  return response.data
}

export async function createBrand(payload: BrandCreatePayload): Promise<Brand> {
  const response = await api.post<Brand>('/brands', payload)
  return response.data
}

export async function updateBrand(
  id: string,
  payload: BrandUpdatePayload,
): Promise<Brand> {
  const response = await api.put<Brand>(`/brands/${id}`, payload)
  return response.data
}

export async function deleteBrand(id: string): Promise<void> {
  await api.delete(`/brands/${id}`)
}

// --- categories -------------------------------------------------------

export async function listCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>('/categories')
  return response.data
}

export async function createCategory(
  payload: CategoryCreatePayload,
): Promise<Category> {
  const response = await api.post<Category>('/categories', payload)
  return response.data
}

export async function updateCategory(
  id: string,
  payload: CategoryUpdatePayload,
): Promise<Category> {
  const response = await api.put<Category>(`/categories/${id}`, payload)
  return response.data
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`)
}

// --- SimpleCatalogEntityPage bindings ----------------------------------

export const brandApi: SimpleEntityApi<Brand> = {
  list: listBrands,
  create: createBrand,
  update: updateBrand,
  remove: deleteBrand,
}

export const categoryApi: SimpleEntityApi<Category> = {
  list: listCategories,
  create: createCategory,
  update: updateCategory,
  remove: deleteCategory,
}

// --- products ---------------------------------------------------------

export async function listProducts(): Promise<Product[]> {
  const response = await api.get<Product[]>('/products')
  return response.data
}

export async function createProduct(
  payload: ProductCreatePayload,
): Promise<Product> {
  const response = await api.post<Product>('/products', payload)
  return response.data
}

export async function updateProduct(
  id: string,
  payload: ProductUpdatePayload,
): Promise<Product> {
  const response = await api.put<Product>(`/products/${id}`, payload)
  return response.data
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`)
}
