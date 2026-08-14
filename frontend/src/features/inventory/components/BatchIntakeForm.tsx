import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'
import type { BatchIntakePayload } from '../types/inventory'

// Mirrors BatchIntakeCreate (backend/app/modules/inventory/schemas)
// field-by-field: lot_code optional max_length=50, quantity gt=0,
// unit_cost ge=0, source_reference optional max_length=100, notes optional
// max_length=500. location_id is never sent from this form (F7 design
// decision 2) -- the backend auto-resolves it.
const decimalField = z
  .string()
  .min(1, 'Requerido.')
  .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
    message: 'Debe ser un número mayor o igual a 0.',
  })

const quantityField = z
  .string()
  .min(1, 'Requerido.')
  .refine(
    (value) => Number.isInteger(Number(value)) && Number(value) > 0,
    { message: 'Debe ser un número entero mayor a 0.' },
  )

const batchIntakeSchema = z.object({
  lot_code: z.string().max(50, 'No puede superar 50 caracteres.').optional(),
  quantity: quantityField,
  unit_cost: decimalField,
  source_reference: z
    .string()
    .max(100, 'No puede superar 100 caracteres.')
    .optional(),
  notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
})

export type BatchIntakeFormValues = z.infer<typeof batchIntakeSchema>

export interface BatchIntakeFormProps {
  productId: string
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: BatchIntakePayload) => void
  onCancel: () => void
}

export function BatchIntakeForm({
  productId,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: BatchIntakeFormProps) {
  const form = useForm<BatchIntakeFormValues>({
    resolver: zodResolver(batchIntakeSchema),
    defaultValues: {
      lot_code: '',
      quantity: '',
      unit_cost: '',
      source_reference: '',
      notes: '',
    },
  })

  function handleSubmit(values: BatchIntakeFormValues) {
    onSubmit({
      product_id: productId,
      lot_code: values.lot_code?.trim() ? values.lot_code : null,
      quantity: Number(values.quantity),
      unit_cost: values.unit_cost,
      source_reference: values.source_reference?.trim()
        ? values.source_reference
        : null,
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
        <label htmlFor="batch-lot-code" className="block text-sm font-medium text-ink">
          Código de lote (opcional)
        </label>
        <Input
          id="batch-lot-code"
          className="mt-1"
          error={Boolean(form.formState.errors.lot_code)}
          {...form.register('lot_code')}
        />
        {form.formState.errors.lot_code ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.lot_code.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="batch-quantity" className="block text-sm font-medium text-ink">
            Cantidad
          </label>
          <Input
            id="batch-quantity"
            type="text"
            inputMode="numeric"
            className="mt-1"
            error={Boolean(form.formState.errors.quantity)}
            {...form.register('quantity')}
          />
          {form.formState.errors.quantity ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.quantity.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="batch-unit-cost" className="block text-sm font-medium text-ink">
            Costo unitario
          </label>
          <Input
            id="batch-unit-cost"
            type="text"
            inputMode="decimal"
            className="mt-1"
            error={Boolean(form.formState.errors.unit_cost)}
            {...form.register('unit_cost')}
          />
          {form.formState.errors.unit_cost ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {form.formState.errors.unit_cost.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="batch-source-reference"
          className="block text-sm font-medium text-ink"
        >
          Referencia (opcional)
        </label>
        <Input
          id="batch-source-reference"
          className="mt-1"
          error={Boolean(form.formState.errors.source_reference)}
          {...form.register('source_reference')}
        />
        {form.formState.errors.source_reference ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.source_reference.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="batch-notes" className="block text-sm font-medium text-ink">
          Notas (opcional)
        </label>
        <Textarea
          id="batch-notes"
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
          {submitting ? 'Guardando…' : 'Registrar entrada'}
        </Button>
      </div>
    </form>
  )
}
