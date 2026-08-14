import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import { SaleLineFields } from './SaleLineFields'
import { useCustomerOptionsQuery, useProductOptionsQuery } from '../hooks/useSales'
import type { ProductRef, SaleCreatePayload } from '../types/sale'

// Mirrors SaleCreate/SaleLineCreate (backend/app/modules/sale/schemas)
// field-by-field: customer_id optional (backend falls back to the default
// customer, or 400 "No customer_id was provided and no default customer
// is configured." if none exists), notes max_length=500, lines
// min_length=1. SaleLineCreate.quantity gt=0, unit_price optional
// (backend falls back to product.sale_price), imei max_length=15. The
// cross-field rules (serial => quantity=1 and imei required; batch/none
// => imei forbidden) mirror SaleService._validate_lines exactly
// (backend/app/modules/sale/services/sale_service.py). location_id is
// never sent from this form (same decision as F7-F9: no endpoint exists
// to list locations, the backend auto-resolves it).
const optionalDecimalField = z
  .string()
  .optional()
  .refine(
    (value) =>
      !value || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    { message: 'Debe ser un número mayor o igual a 0.' },
  )

function buildLineSchema(products: ProductRef[]) {
  return z
    .object({
      product_id: z.string().min(1, 'Selecciona un producto.'),
      quantity: z.string().min(1, 'Requerido.'),
      unit_price: optionalDecimalField,
      imei: z.string().max(15, 'No puede superar 15 caracteres.').optional(),
    })
    .superRefine((line, ctx) => {
      const product = products.find((item) => item.id === line.product_id)
      if (!product) return

      const quantity = Number(line.quantity)

      if (product.tracking_type === 'serial') {
        if (!Number.isInteger(quantity) || quantity !== 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['quantity'],
            message: 'Los productos seriales requieren cantidad = 1.',
          })
        }

        if (!line.imei?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['imei'],
            message: 'IMEI requerido para productos seriales.',
          })
        }
      } else {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['quantity'],
            message: 'Debe ser un número entero mayor a 0.',
          })
        }

        if (line.imei?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['imei'],
            message: 'IMEI solo aplica a productos con seguimiento serial.',
          })
        }
      }
    })
}

function buildSaleSchema(products: ProductRef[]) {
  return z.object({
    customer_id: z.string().optional(),
    sale_date: z.string().optional(),
    notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
    lines: z
      .array(buildLineSchema(products))
      .min(1, 'Agrega al menos una línea.'),
  })
}

export type SaleFormValues = z.infer<ReturnType<typeof buildSaleSchema>>

// Stable reference so `products` doesn't become a fresh [] on every
// render while the query is still loading (same fix already applied in
// features/purchases/components/PurchaseForm.tsx).
const EMPTY_PRODUCTS: ProductRef[] = []

const EMPTY_LINE = {
  product_id: '',
  quantity: '',
  unit_price: '',
  imei: '',
}

export interface SaleFormProps {
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: SaleCreatePayload) => void
  onCancel: () => void
}

export function SaleForm({
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: SaleFormProps) {
  const customerOptionsQuery = useCustomerOptionsQuery()
  const productOptionsQuery = useProductOptionsQuery()

  const customers = customerOptionsQuery.data ?? []
  const products = productOptionsQuery.data ?? EMPTY_PRODUCTS

  const schema = useMemo(() => buildSaleSchema(products), [products])

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: '',
      sale_date: '',
      notes: '',
      lines: [EMPTY_LINE],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  })

  const noProducts = productOptionsQuery.isSuccess && products.length === 0

  function handleSubmit(values: SaleFormValues) {
    onSubmit({
      customer_id: values.customer_id?.trim() ? values.customer_id : null,
      sale_date: values.sale_date?.trim()
        ? new Date(values.sale_date).toISOString()
        : null,
      notes: values.notes?.trim() ? values.notes : null,
      lines: values.lines.map((line) => ({
        product_id: line.product_id,
        quantity: Number(line.quantity),
        unit_price: line.unit_price?.trim() ? line.unit_price : null,
        imei: line.imei?.trim() ? line.imei : null,
      })),
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="sale-customer"
            className="block text-sm font-medium text-ink"
          >
            Cliente (opcional)
          </label>
          <Select
            id="sale-customer"
            className="mt-1"
            {...form.register('customer_id')}
          >
            <option value="">Usar cliente por defecto</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-muted">
            Si se deja vacío, el backend usa el cliente marcado como
            predeterminado.
          </p>
        </div>

        <div>
          <label
            htmlFor="sale-date"
            className="block text-sm font-medium text-ink"
          >
            Fecha (opcional)
          </label>
          <Input
            id="sale-date"
            type="date"
            className="mt-1"
            {...form.register('sale_date')}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Si se deja vacío, el backend usa la fecha y hora actuales.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="sale-notes"
          className="block text-sm font-medium text-ink"
        >
          Notas (opcional)
        </label>
        <Textarea
          id="sale-notes"
          rows={2}
          className="mt-1"
          error={Boolean(form.formState.errors.notes)}
          {...form.register('notes')}
        />
        {form.formState.errors.notes ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.notes.message}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Líneas</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={noProducts}
            onClick={() => append(EMPTY_LINE)}
          >
            <Plus size={16} aria-hidden="true" />
            Agregar línea
          </Button>
        </div>

        {noProducts ? (
          <p className="mt-2 text-xs text-ink-muted">
            No hay productos activos. Crea uno primero en Catálogo.
          </p>
        ) : null}

        {form.formState.errors.lines?.message ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {form.formState.errors.lines.message}
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          {fields.map((field, index) => (
            <SaleLineFields
              key={field.id}
              form={form}
              index={index}
              products={products}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
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
          {submitting ? 'Guardando…' : 'Registrar venta'}
        </Button>
      </div>
    </form>
  )
}
