import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import type { BatchAdjustmentPayload } from '../types/inventory'

// Mirrors StockAdjustmentCreate's batch/none branch
// (backend/app/modules/inventory/services/inventory_service.py
// _adjust_lot_quantity): quantity is required (gt=0), unit_cost is
// required only for inbound adjustments (a new lot is created), and
// outbound adjustments draw from the earliest lot with available stock --
// no lot picker here, matching the backend's own FIFO selection.
const quantityField = z
  .string()
  .min(1, 'Requerido.')
  .refine(
    (value) => Number.isInteger(Number(value)) && Number(value) > 0,
    { message: 'Debe ser un número entero mayor a 0.' },
  )

const batchAdjustmentSchema = z
  .object({
    direction: z.enum(['in', 'out']),
    quantity: quantityField,
    unit_cost: z.string().optional(),
    notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
  })
  .refine(
    (data) =>
      data.direction !== 'in' ||
      (data.unit_cost !== undefined &&
        data.unit_cost.trim() !== '' &&
        !Number.isNaN(Number(data.unit_cost)) &&
        Number(data.unit_cost) >= 0),
    {
      message: 'Requerido para ajustes de entrada.',
      path: ['unit_cost'],
    },
  )

export type BatchAdjustmentFormValues = z.infer<typeof batchAdjustmentSchema>

export interface BatchAdjustmentFormProps {
  productId: string
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: BatchAdjustmentPayload) => void
  onCancel: () => void
}

export function BatchAdjustmentForm({
  productId,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: BatchAdjustmentFormProps) {
  const form = useForm<BatchAdjustmentFormValues>({
    resolver: zodResolver(batchAdjustmentSchema),
    defaultValues: {
      direction: 'in',
      quantity: '',
      unit_cost: '',
      notes: '',
    },
  })

  // Local state instead of form.watch('direction'): react-hook-form's
  // watch() is a subscription API the React Compiler can't safely
  // memoize, so it opts the whole component out of memoization. A plain
  // useState mirrored via the Select's onChange keeps the conditional
  // unit_cost field reactive without that trade-off.
  const [direction, setDirection] = useState<'in' | 'out'>('in')

  function handleSubmit(values: BatchAdjustmentFormValues) {
    onSubmit({
      product_id: productId,
      direction: values.direction,
      quantity: Number(values.quantity),
      unit_cost:
        values.direction === 'in' && values.unit_cost
          ? values.unit_cost
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
        <label htmlFor="batch-adjust-direction" className="block text-sm font-medium text-ink">
          Dirección
        </label>
        <Select
          id="batch-adjust-direction"
          className="mt-1"
          {...form.register('direction', {
            onChange: (event) =>
              setDirection(event.target.value as 'in' | 'out'),
          })}
        >
          <option value="in">Entrada</option>
          <option value="out">Salida</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="batch-adjust-quantity" className="block text-sm font-medium text-ink">
            Cantidad
          </label>
          <Input
            id="batch-adjust-quantity"
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

        {direction === 'in' ? (
          <div>
            <label
              htmlFor="batch-adjust-unit-cost"
              className="block text-sm font-medium text-ink"
            >
              Costo unitario
            </label>
            <Input
              id="batch-adjust-unit-cost"
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
        ) : null}
      </div>

      <div>
        <label htmlFor="batch-adjust-notes" className="block text-sm font-medium text-ink">
          Notas (opcional)
        </label>
        <Textarea
          id="batch-adjust-notes"
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
