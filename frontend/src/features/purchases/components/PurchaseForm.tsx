import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import { PurchaseLineFields } from './PurchaseLineFields'
import { useProductOptionsQuery, useSupplierOptionsQuery } from '../hooks/usePurchases'
import type { ProductRef, PurchaseCreatePayload } from '../types/purchase'

// Mirrors PurchaseCreate/PurchaseLineCreate (backend/app/modules/purchase/schemas)
// field-by-field: invoice_number max_length=50, notes max_length=500,
// lines min_length=1, PurchaseLineCreate.quantity gt=0, unit_cost ge=0,
// imei/imei2 max_length=15, lot_code max_length=50. The cross-field rules
// (serial => quantity=1 and imei required; batch/none => imei forbidden)
// mirror PurchaseService._validate_lines exactly (backend/app/modules/purchase/services/purchase_service.py).
// location_id is never sent from this form (same decision as F7/F8: no
// endpoint exists to list locations, the backend auto-resolves it).
const decimalField = z
  .string()
  .min(1, 'Requerido.')
  .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
    message: 'Debe ser un número mayor o igual a 0.',
  })

function buildLineSchema(products: ProductRef[]) {
  return z
    .object({
      product_id: z.string().min(1, 'Selecciona un producto.'),
      quantity: z.string().min(1, 'Requerido.'),
      unit_cost: decimalField,
      imei: z.string().max(15, 'No puede superar 15 caracteres.').optional(),
      imei2: z.string().max(15, 'No puede superar 15 caracteres.').optional(),
      lot_code: z.string().max(50, 'No puede superar 50 caracteres.').optional(),
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

        if (line.imei?.trim() || line.imei2?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['imei'],
            message: 'IMEI solo aplica a productos con seguimiento serial.',
          })
        }
      }
    })
}

function buildPurchaseSchema(products: ProductRef[]) {
  return z.object({
    supplier_id: z.string().min(1, 'Selecciona un proveedor.'),
    invoice_number: z
      .string()
      .max(50, 'No puede superar 50 caracteres.')
      .optional(),
    purchase_date: z.string().optional(),
    notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
    lines: z
      .array(buildLineSchema(products))
      .min(1, 'Agrega al menos una línea.'),
  })
}

export type PurchaseFormValues = z.infer<ReturnType<typeof buildPurchaseSchema>>

// Stable reference so `products` doesn't become a fresh [] on every
// render while the query is still loading, which would otherwise
// recompute `schema` (and remount every line's resolver) on each render.
const EMPTY_PRODUCTS: ProductRef[] = []

const EMPTY_LINE = {
  product_id: '',
  quantity: '',
  unit_cost: '',
  imei: '',
  imei2: '',
  lot_code: '',
}

export interface PurchaseFormProps {
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: PurchaseCreatePayload) => void
  onCancel: () => void
}

export function PurchaseForm({
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: PurchaseFormProps) {
  const supplierOptionsQuery = useSupplierOptionsQuery()
  const productOptionsQuery = useProductOptionsQuery()

  const suppliers = supplierOptionsQuery.data ?? []
  const products = productOptionsQuery.data ?? EMPTY_PRODUCTS

  const schema = useMemo(() => buildPurchaseSchema(products), [products])

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id: '',
      invoice_number: '',
      purchase_date: '',
      notes: '',
      lines: [EMPTY_LINE],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  })

  const noSuppliers = supplierOptionsQuery.isSuccess && suppliers.length === 0
  const noProducts = productOptionsQuery.isSuccess && products.length === 0

  function handleSubmit(values: PurchaseFormValues) {
    onSubmit({
      supplier_id: values.supplier_id,
      invoice_number: values.invoice_number?.trim()
        ? values.invoice_number
        : null,
      purchase_date: values.purchase_date?.trim()
        ? new Date(values.purchase_date).toISOString()
        : null,
      notes: values.notes?.trim() ? values.notes : null,
      lines: values.lines.map((line) => ({
        product_id: line.product_id,
        quantity: Number(line.quantity),
        unit_cost: line.unit_cost,
        imei: line.imei?.trim() ? line.imei : null,
        imei2: line.imei2?.trim() ? line.imei2 : null,
        lot_code: line.lot_code?.trim() ? line.lot_code : null,
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
            htmlFor="purchase-supplier"
            className="block text-sm font-medium text-ink"
          >
            Proveedor
          </label>
          <Select
            id="purchase-supplier"
            className="mt-1"
            disabled={noSuppliers}
            error={Boolean(form.formState.errors.supplier_id)}
            {...form.register('supplier_id')}
          >
            <option value="">Selecciona…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
          {noSuppliers ? (
            <p className="mt-1 text-xs text-ink-muted">
              No hay proveedores activos. Crea uno primero en Proveedores.
            </p>
          ) : form.formState.errors.supplier_id ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.supplier_id.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="purchase-invoice-number"
            className="block text-sm font-medium text-ink"
          >
            Nº de factura (opcional)
          </label>
          <Input
            id="purchase-invoice-number"
            className="mt-1"
            error={Boolean(form.formState.errors.invoice_number)}
            {...form.register('invoice_number')}
          />
          {form.formState.errors.invoice_number ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.invoice_number.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="purchase-date"
            className="block text-sm font-medium text-ink"
          >
            Fecha (opcional)
          </label>
          <Input
            id="purchase-date"
            type="date"
            className="mt-1"
            {...form.register('purchase_date')}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Si se deja vacío, el backend usa la fecha y hora actuales.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="purchase-notes"
          className="block text-sm font-medium text-ink"
        >
          Notas (opcional)
        </label>
        <Textarea
          id="purchase-notes"
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
            <PurchaseLineFields
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
          {submitting ? 'Guardando…' : 'Registrar compra'}
        </Button>
      </div>
    </form>
  )
}
