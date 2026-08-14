import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'
import type { SerialIntakePayload } from '../types/inventory'

// Mirrors SerialIntakeCreate (backend/app/modules/inventory/schemas)
// field-by-field: imei min_length=1/max_length=15, imei2 optional
// max_length=15, unit_cost ge=0, source_reference optional max_length=100,
// notes optional max_length=500. location_id is never sent from this form
// (F7 design decision 2) -- the backend auto-resolves it.
const decimalField = z
  .string()
  .min(1, 'Requerido.')
  .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
    message: 'Debe ser un número mayor o igual a 0.',
  })

const serialIntakeSchema = z.object({
  imei: z
    .string()
    .min(1, 'Requerido.')
    .max(15, 'No puede superar 15 caracteres.'),
  imei2: z.string().max(15, 'No puede superar 15 caracteres.').optional(),
  unit_cost: decimalField,
  source_reference: z
    .string()
    .max(100, 'No puede superar 100 caracteres.')
    .optional(),
  notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
})

export type SerialIntakeFormValues = z.infer<typeof serialIntakeSchema>

export interface SerialIntakeFormProps {
  productId: string
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: SerialIntakePayload) => void
  onCancel: () => void
}

export function SerialIntakeForm({
  productId,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: SerialIntakeFormProps) {
  const form = useForm<SerialIntakeFormValues>({
    resolver: zodResolver(serialIntakeSchema),
    defaultValues: {
      imei: '',
      imei2: '',
      unit_cost: '',
      source_reference: '',
      notes: '',
    },
  })

  function handleSubmit(values: SerialIntakeFormValues) {
    onSubmit({
      product_id: productId,
      imei: values.imei,
      imei2: values.imei2?.trim() ? values.imei2 : null,
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
        <label htmlFor="intake-imei" className="block text-sm font-medium text-ink">
          IMEI
        </label>
        <Input
          id="intake-imei"
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
        <label htmlFor="intake-imei2" className="block text-sm font-medium text-ink">
          IMEI 2 (opcional)
        </label>
        <Input
          id="intake-imei2"
          className="mt-1"
          error={Boolean(form.formState.errors.imei2)}
          {...form.register('imei2')}
        />
        {form.formState.errors.imei2 ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.imei2.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="intake-unit-cost" className="block text-sm font-medium text-ink">
          Costo unitario
        </label>
        <Input
          id="intake-unit-cost"
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

      <div>
        <label
          htmlFor="intake-source-reference"
          className="block text-sm font-medium text-ink"
        >
          Referencia (opcional)
        </label>
        <Input
          id="intake-source-reference"
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
        <label htmlFor="intake-notes" className="block text-sm font-medium text-ink">
          Notas (opcional)
        </label>
        <Textarea
          id="intake-notes"
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
