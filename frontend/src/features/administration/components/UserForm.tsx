import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type {
  User,
  UserCreatePayload,
  UserUpdatePayload,
} from '../types/user'
import type { RoleSummary } from '../types/role'

// Mirrors backend/app/modules/auth/schemas/user_create.py (UserCreate):
// email is EmailStr (format-validated server-side, unlike Customer's plain
// str), full_name 2-150, password 8-72, role_ids defaults to [].
const createUserSchema = z.object({
  email: z.string().email('Ingresa un email válido.'),
  full_name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(150, 'No puede superar 150 caracteres.'),
  password: z
    .string()
    .min(8, 'Debe tener al menos 8 caracteres.')
    .max(72, 'No puede superar 72 caracteres.'),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

// Mirrors user_update.py (UserUpdate): only email/full_name -- no
// password, no role_ids (role assignment is a separate endpoint/dialog).
const editUserSchema = z.object({
  email: z.string().email('Ingresa un email válido.'),
  full_name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(150, 'No puede superar 150 caracteres.'),
})

type EditUserFormValues = z.infer<typeof editUserSchema>

export interface UserFormProps {
  defaultValues?: User
  availableRoles: RoleSummary[]
  submitting: boolean
  rootError: string | null
  onSubmit: (payload: UserCreatePayload | UserUpdatePayload) => void
  onCancel: () => void
}

export function UserForm(props: UserFormProps) {
  return props.defaultValues ? (
    <EditUserForm {...props} defaultValues={props.defaultValues} />
  ) : (
    <CreateUserForm {...props} />
  )
}

function CreateUserForm({
  availableRoles,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', full_name: '', password: '' },
  })

  const [roleSelection, setRoleSelection] = useState<Set<string>>(new Set())

  function handleSubmit(values: CreateUserFormValues) {
    onSubmit({
      email: values.email,
      full_name: values.full_name,
      password: values.password,
      role_ids: Array.from(roleSelection),
    })
  }

  function toggleRole(id: string) {
    setRoleSelection((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
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
          htmlFor="user-email"
          className="block text-sm font-medium text-ink"
        >
          Email
        </label>
        <Input
          id="user-email"
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
          htmlFor="user-full-name"
          className="block text-sm font-medium text-ink"
        >
          Nombre completo
        </label>
        <Input
          id="user-full-name"
          className="mt-1"
          error={Boolean(form.formState.errors.full_name)}
          {...form.register('full_name')}
        />
        {form.formState.errors.full_name ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.full_name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="user-password"
          className="block text-sm font-medium text-ink"
        >
          Contraseña
        </label>
        <Input
          id="user-password"
          type="password"
          className="mt-1"
          error={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <div>
        <span className="block text-sm font-medium text-ink">Roles</span>
        <fieldset className="mt-1 max-h-48 space-y-2 overflow-y-auto rounded-md border border-line p-3">
          <legend className="sr-only">Roles</legend>
          {availableRoles.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No hay roles activos disponibles.
            </p>
          ) : (
            availableRoles.map((role) => (
              <label
                key={role.id}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={roleSelection.has(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 rounded border-line text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                {role.name}
              </label>
            ))
          )}
        </fieldset>
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

function EditUserForm({
  defaultValues,
  submitting,
  rootError,
  onSubmit,
  onCancel,
}: UserFormProps & { defaultValues: User }) {
  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: defaultValues.email,
      full_name: defaultValues.full_name,
    },
  })

  function handleSubmit(values: EditUserFormValues) {
    onSubmit({
      email: values.email,
      full_name: values.full_name,
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
          htmlFor="user-email"
          className="block text-sm font-medium text-ink"
        >
          Email
        </label>
        <Input
          id="user-email"
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
          htmlFor="user-full-name"
          className="block text-sm font-medium text-ink"
        >
          Nombre completo
        </label>
        <Input
          id="user-full-name"
          className="mt-1"
          error={Boolean(form.formState.errors.full_name)}
          {...form.register('full_name')}
        />
        {form.formState.errors.full_name ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.full_name.message}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-ink-muted">
        La contraseña y los roles se gestionan por separado.
      </p>

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
