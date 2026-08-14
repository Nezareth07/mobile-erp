import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'
import type { Role, RoleCreatePayload, RoleUpdatePayload } from '../types/role'

// Mirrors backend/app/modules/auth/schemas/{role_create,role_update}.py:
// name 2-50, description optional up to 255.
const roleSchema = z.object({
  name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(50, 'No puede superar 50 caracteres.'),
  description: z
    .string()
    .max(255, 'No puede superar 255 caracteres.')
    .optional(),
})

type RoleFormValues = z.infer<typeof roleSchema>

export interface RoleFormProps {
  defaultValues?: Role
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: RoleCreatePayload | RoleUpdatePayload) => void
  onCancel: () => void
}

export function RoleForm({
  defaultValues,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: RoleFormProps) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
    },
  })

  function handleSubmit(values: RoleFormValues) {
    onSubmit({
      name: values.name,
      description: values.description?.trim() ? values.description : null,
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
          htmlFor="role-name"
          className="block text-sm font-medium text-ink"
        >
          Nombre
        </label>
        <Input
          id="role-name"
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
          htmlFor="role-description"
          className="block text-sm font-medium text-ink"
        >
          Descripción
        </label>
        <Textarea
          id="role-description"
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
