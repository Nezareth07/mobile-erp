import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProduct,
  deleteProduct,
  listBrands,
  listCategories,
  listProducts,
  updateProduct,
} from '../api'
import type { ProductCreatePayload, ProductUpdatePayload } from '../types/catalog'

const PRODUCTS_KEY = ['catalog', 'products']

export function useProductsQuery() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: listProducts,
  })
}

// Reuses the same query keys as the Brands/Categories tabs (Table 5.5:
// useSimpleCatalogEntity) so the reference lists used to populate the
// product form's selects share one cache entry instead of double-fetching.
export function useBrandOptionsQuery() {
  return useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: listBrands,
  })
}

export function useCategoryOptionsQuery() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: listCategories,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ProductCreatePayload) => createProduct(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: ProductUpdatePayload
    }) => updateProduct(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })
}
