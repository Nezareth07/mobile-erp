import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'
import type { Supplier, SupplierCreatePayload } from '../types/supplier'

// Mirrors SupplierCreate/SupplierUpdate (backend/app/modules/supplier/schemas)
// field-by-field. `email` is a plain `str | None` on the backend (not
// EmailStr) -- no format validation is added here, only the length cap.
const supplierSchema = z.object({
  name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(150, 'No puede superar 150 caracteres.'),
  tax_id: z.string().max(20, 'No puede superar 20 caracteres.').optional(),
  contact_name: z
    .string()
    .max(100, 'No puede superar 100 caracteres.')
    .optional(),
  phone: z.string().max(30, 'No puede superar 30 caracteres.').optional(),
  email: z.string().max(255, 'No puede superar 255 caracteres.').optional(),
  address: z
    .string()
    .max(255, 'No puede superar 255 caracteres.')
    .optional(),
  notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export interface SupplierFormProps {
  defaultValues?: Supplier
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: SupplierCreatePayload) => void
  onCancel: () => void
}

export function SupplierForm({
  defaultValues,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      tax_id: defaultValues?.tax_id ?? '',
      contact_name: defaultValues?.contact_name ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      address: defaultValues?.address ?? '',
      notes: defaultValues?.notes ?? '',
    },
  })

  function handleSubmit(values: SupplierFormValues) {
    onSubmit({
      name: values.name,
      tax_id: values.tax_id?.trim() ? values.tax_id : null,
      contact_name: values.contact_name?.trim() ? values.contact_name : null,
      phone: values.phone?.trim() ? values.phone : null,
      email: values.email?.trim() ? values.email : null,
      address: values.address?.trim() ? values.address : null,
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
        <label
          htmlFor="supplier-name"
          className="block text-sm font-medium text-ink"
        >
          Nombre
        </label>
        <Input
          id="supplier-name"
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
        <label
          htmlFor="supplier-tax-id"
          className="block text-sm font-medium text-ink"
        >
          RUC / Tax ID
        </label>
        <Input
          id="supplier-tax-id"
          className="mt-1"
          error={Boolean(form.formState.errors.tax_id)}
          {...form.register('tax_id')}
        />
        {form.formState.errors.tax_id ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.tax_id.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="supplier-contact-name"
          className="block text-sm font-medium text-ink"
        >
          Persona de contacto
        </label>
        <Input
          id="supplier-contact-name"
          className="mt-1"
          error={Boolean(form.formState.errors.contact_name)}
          {...form.register('contact_name')}
        />
        {form.formState.errors.contact_name ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.contact_name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="supplier-phone"
          className="block text-sm font-medium text-ink"
        >
          Teléfono
        </label>
        <Input
          id="supplier-phone"
          type="text"
          className="mt-1"
          error={Boolean(form.formState.errors.phone)}
          {...form.register('phone')}
        />
        {form.formState.errors.phone ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.phone.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="supplier-email"
          className="block text-sm font-medium text-ink"
        >
          Email
        </label>
        <Input
          id="supplier-email"
          type="text"
          className="mt-1"
          error={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="supplier-address"
          className="block text-sm font-medium text-ink"
        >
          Dirección
        </label>
        <Input
          id="supplier-address"
          className="mt-1"
          error={Boolean(form.formState.errors.address)}
          {...form.register('address')}
        />
        {form.formState.errors.address ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.address.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="supplier-notes"
          className="block text-sm font-medium text-ink"
        >
          Notas
        </label>
        <Textarea
          id="supplier-notes"
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
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
