import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import { useBrandOptionsQuery, useCategoryOptionsQuery } from '../hooks/useProducts'
import type { Product, ProductCreatePayload, TrackingType } from '../types/catalog'

// Mirrors ProductCreate/ProductUpdate (backend/app/modules/product/schemas)
// field-by-field: name min_length=2/max_length=150, description
// max_length=500, sku min_length=1/max_length=50, cost_price/sale_price
// ge=0, plus the cross-field rule from ProductService.create_product:
// "Sale price cannot be lower than cost price."
const priceField = z
  .string()
  .min(1, 'Requerido.')
  .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
    message: 'Debe ser un número mayor o igual a 0.',
  })

const productSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Debe tener al menos 2 caracteres.')
      .max(150, 'No puede superar 150 caracteres.'),
    description: z
      .string()
      .max(500, 'No puede superar 500 caracteres.')
      .optional(),
    sku: z
      .string()
      .min(1, 'Requerido.')
      .max(50, 'No puede superar 50 caracteres.'),
    brand_id: z.string().min(1, 'Selecciona una marca.'),
    category_id: z.string().min(1, 'Selecciona una categoría.'),
    tracking_type: z.enum(['none', 'serial', 'batch']),
    cost_price: priceField,
    sale_price: priceField,
  })
  .refine((data) => Number(data.sale_price) >= Number(data.cost_price), {
    message: 'El precio de venta no puede ser menor al precio de costo.',
    path: ['sale_price'],
  })

export type ProductFormValues = z.infer<typeof productSchema>

const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  none: 'Sin seguimiento',
  serial: 'Serial (IMEI)',
  batch: 'Lote',
}

export interface ProductFormProps {
  defaultValues?: Product
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: ProductCreatePayload) => void
  onCancel: () => void
}

export function ProductForm({
  defaultValues,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const brandOptionsQuery = useBrandOptionsQuery()
  const categoryOptionsQuery = useCategoryOptionsQuery()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      sku: defaultValues?.sku ?? '',
      brand_id: defaultValues?.brand.id ?? '',
      category_id: defaultValues?.category.id ?? '',
      tracking_type: defaultValues?.tracking_type ?? 'none',
      cost_price: defaultValues?.cost_price ?? '',
      sale_price: defaultValues?.sale_price ?? '',
    },
  })

  const brands = brandOptionsQuery.data ?? []
  const categories = categoryOptionsQuery.data ?? []

  // Edit mode only: if the product's current brand/category is no longer
  // active, GET /brands|/categories won't include it, which would silently
  // blank the <select> and block saving unrelated field changes (the DOM
  // falls back to no option selected, so RHF reads "" and Zod rejects it).
  // Keep it as a single extra option representing only the existing
  // assignment -- never offered when creating a new product, since
  // defaultValues is undefined there.
  const currentBrandOption =
    defaultValues && !brands.some((brand) => brand.id === defaultValues.brand.id)
      ? defaultValues.brand
      : null
  const currentCategoryOption =
    defaultValues &&
    !categories.some((category) => category.id === defaultValues.category.id)
      ? defaultValues.category
      : null

  const noBrands =
    brandOptionsQuery.isSuccess && brands.length === 0 && !currentBrandOption
  const noCategories =
    categoryOptionsQuery.isSuccess &&
    categories.length === 0 &&
    !currentCategoryOption

  function handleSubmit(values: ProductFormValues) {
    onSubmit({
      name: values.name,
      description: values.description?.trim() ? values.description : null,
      sku: values.sku,
      brand_id: values.brand_id,
      category_id: values.category_id,
      tracking_type: values.tracking_type,
      cost_price: values.cost_price,
      sale_price: values.sale_price,
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      className="space-y-4"
    >
      <div>
        <label htmlFor="product-name" className="block text-sm font-medium text-ink">
          Nombre
        </label>
        <Input
          id="product-name"
          className="mt-1"
          error={Boolean(form.formState.errors.name)}
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="product-sku" className="block text-sm font-medium text-ink">
          SKU
        </label>
        <Input
          id="product-sku"
          className="mt-1"
          error={Boolean(form.formState.errors.sku)}
          {...form.register('sku')}
        />
        {form.formState.errors.sku ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.sku.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="product-brand" className="block text-sm font-medium text-ink">
            Marca
          </label>
          <Select
            id="product-brand"
            className="mt-1"
            disabled={noBrands}
            error={Boolean(form.formState.errors.brand_id)}
            {...form.register('brand_id')}
          >
            <option value="">Selecciona…</option>
            {currentBrandOption ? (
              <option value={currentBrandOption.id}>
                {currentBrandOption.name} (inactiva)
              </option>
            ) : null}
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
          {noBrands ? (
            <p className="mt-1 text-xs text-ink-muted">
              No hay marcas activas. Crea una primero en Catálogo → Marcas.
            </p>
          ) : form.formState.errors.brand_id ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.brand_id.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="product-category" className="block text-sm font-medium text-ink">
            Categoría
          </label>
          <Select
            id="product-category"
            className="mt-1"
            disabled={noCategories}
            error={Boolean(form.formState.errors.category_id)}
            {...form.register('category_id')}
          >
            <option value="">Selecciona…</option>
            {currentCategoryOption ? (
              <option value={currentCategoryOption.id}>
                {currentCategoryOption.name} (inactiva)
              </option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {noCategories ? (
            <p className="mt-1 text-xs text-ink-muted">
              No hay categorías activas. Crea una primero en Catálogo → Categorías.
            </p>
          ) : form.formState.errors.category_id ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.category_id.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="product-tracking" className="block text-sm font-medium text-ink">
          Tipo de seguimiento
        </label>
        <Select
          id="product-tracking"
          className="mt-1"
          {...form.register('tracking_type')}
        >
          {(Object.entries(TRACKING_TYPE_LABELS) as [TrackingType, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="product-cost" className="block text-sm font-medium text-ink">
            Precio de costo
          </label>
          <Input
            id="product-cost"
            type="text"
            inputMode="decimal"
            className="mt-1"
            error={Boolean(form.formState.errors.cost_price)}
            {...form.register('cost_price')}
          />
          {form.formState.errors.cost_price ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.cost_price.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="product-sale" className="block text-sm font-medium text-ink">
            Precio de venta
          </label>
          <Input
            id="product-sale"
            type="text"
            inputMode="decimal"
            className="mt-1"
            error={Boolean(form.formState.errors.sale_price)}
            {...form.register('sale_price')}
          />
          {form.formState.errors.sale_price ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.sale_price.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="product-description" className="block text-sm font-medium text-ink">
          Descripción
        </label>
        <Textarea
          id="product-description"
          rows={3}
          className="mt-1"
          error={Boolean(form.formState.errors.description)}
          {...form.register('description')}
        />
        {form.formState.errors.description ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      {rootError ? (
        <p role="alert" className="text-sm text-danger">
          {rootError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
