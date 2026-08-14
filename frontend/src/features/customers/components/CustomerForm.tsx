import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'
import type { Customer, CustomerCreatePayload } from '../types/customer'

// Mirrors CustomerCreate/CustomerUpdate (backend/app/modules/customer/schemas)
// field-by-field. `email` is a plain `str | None` on the backend (not
// EmailStr) -- no format validation is added here, only the length cap,
// same criterion already used in features/suppliers/components/SupplierForm.tsx.
const customerSchema = z.object({
  name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(150, 'No puede superar 150 caracteres.'),
  document_id: z
    .string()
    .max(20, 'No puede superar 20 caracteres.')
    .optional(),
  phone: z.string().max(30, 'No puede superar 30 caracteres.').optional(),
  email: z.string().max(255, 'No puede superar 255 caracteres.').optional(),
  address: z
    .string()
    .max(255, 'No puede superar 255 caracteres.')
    .optional(),
  notes: z.string().max(500, 'No puede superar 500 caracteres.').optional(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

export interface CustomerFormProps {
  defaultValues?: Customer
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: CustomerCreatePayload) => void
  onCancel: () => void
}

export function CustomerForm({
  defaultValues,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      document_id: defaultValues?.document_id ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      address: defaultValues?.address ?? '',
      notes: defaultValues?.notes ?? '',
    },
  })

  function handleSubmit(values: CustomerFormValues) {
    onSubmit({
      name: values.name,
      document_id: values.document_id?.trim() ? values.document_id : null,
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
          htmlFor="customer-name"
          className="block text-sm font-medium text-ink"
        >
          Nombre
        </label>
        <Input
          id="customer-name"
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
          htmlFor="customer-document-id"
          className="block text-sm font-medium text-ink"
        >
          Documento de identidad
        </label>
        <Input
          id="customer-document-id"
          className="mt-1"
          error={Boolean(form.formState.errors.document_id)}
          {...form.register('document_id')}
        />
        {form.formState.errors.document_id ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.document_id.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="customer-phone"
          className="block text-sm font-medium text-ink"
        >
          Teléfono
        </label>
        <Input
          id="customer-phone"
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
          htmlFor="customer-email"
          className="block text-sm font-medium text-ink"
        >
          Email
        </label>
        <Input
          id="customer-email"
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
          htmlFor="customer-address"
          className="block text-sm font-medium text-ink"
        >
          Dirección
        </label>
        <Input
          id="customer-address"
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
          htmlFor="customer-notes"
          className="block text-sm font-medium text-ink"
        >
          Notas
        </label>
        <Textarea
          id="customer-notes"
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
