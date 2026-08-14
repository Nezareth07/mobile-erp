import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import type {
  ProductUnitStatus,
  SerialAdjustmentPayload,
} from '../types/inventory'

// Mirrors StockAdjustmentCreate's serial branch
// (backend/app/modules/inventory/services/inventory_service.py
// _adjust_serial_unit): imei is required, new_status is required, and the
// unit's IN_STOCK-ness must actually change (verified in the service, not
// re-validated here). `direction` is a required field on the wire schema
// but is not read by the serial branch -- it's derived from new_status
// purely to keep the payload internally consistent.
const STATUS_LABELS: Record<ProductUnitStatus, string> = {
  in_stock: 'En stock',
  reserved: 'Reservado',
  sold: 'Vendido',
  in_warranty: 'En garantía',
  defective: 'Defectuoso',
  returned_to_supplier: 'Devuelto al proveedor',
}

const serialAdjustmentSchema = z.object({
  imei: z
    .string()
    .min(1, 'Requerido.')
    .max(15, 'No puede superar 15 caracteres.'),
  new_status: z.enum([
    'in_stock',
    'reserved',
    'sold',
    'in_warranty',
    'defective',
    'returned_to_supplier',
  ]),
  notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
})

export type SerialAdjustmentFormValues = z.infer<typeof serialAdjustmentSchema>

export interface SerialAdjustmentFormProps {
  productId: string
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: SerialAdjustmentPayload) => void
  onCancel: () => void
}

export function SerialAdjustmentForm({
  productId,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: SerialAdjustmentFormProps) {
  const form = useForm<SerialAdjustmentFormValues>({
    resolver: zodResolver(serialAdjustmentSchema),
    defaultValues: {
      imei: '',
      new_status: 'in_stock',
      notes: '',
    },
  })

  function handleSubmit(values: SerialAdjustmentFormValues) {
    onSubmit({
      product_id: productId,
      direction: values.new_status === 'in_stock' ? 'in' : 'out',
      imei: values.imei,
      new_status: values.new_status,
      notes: values.notes?.trim() ? values.notes : null,
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      className="space-y-4"
    >
      <div>
        <label htmlFor="adjust-imei" className="block text-sm font-medium text-ink">
          IMEI
        </label>
        <Input
          id="adjust-imei"
          className="mt-1"
          error={Boolean(form.formState.errors.imei)}
          {...form.register('imei')}
        />
        {form.formState.errors.imei ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.imei.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="adjust-new-status" className="block text-sm font-medium text-ink">
          Nuevo estado
        </label>
        <Select
          id="adjust-new-status"
          className="mt-1"
          {...form.register('new_status')}
        >
          {(Object.entries(STATUS_LABELS) as [ProductUnitStatus, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </Select>
      </div>

      <div>
        <label htmlFor="adjust-notes" className="block text-sm font-medium text-ink">
          Notas (opcional)
        </label>
        <Textarea
          id="adjust-notes"
          rows={3}
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
          {submitting ? 'Guardando…' : 'Ajustar'}
        </Button>
      </div>
    </form>
  )
}
