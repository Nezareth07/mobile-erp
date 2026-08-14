import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../auth/useAuth'
import { useChangePassword } from './hooks/useChangePassword'
import { extractErrorDetail } from './errors'
import type { ChangePasswordPayload } from './types/account'

// Mirrors backend/app/modules/auth/schemas/user_password_change.py
// (UserPasswordChange) field-by-field: current_password (1-72),
// new_password (8-72).
const changePasswordSchema = z.object({
  current_password: z
    .string()
    .min(1, 'Ingresa tu contraseña actual.')
    .max(72, 'No puede superar 72 caracteres.'),
  new_password: z
    .string()
    .min(8, 'Debe tener al menos 8 caracteres.')
    .max(72, 'No puede superar 72 caracteres.'),
})

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

// The form is a separate component mounted only while `open` is true, so
// every reopen starts from a fresh instance (empty fields, no leftover
// error/success state) without needing an effect to manually reset it --
// ChangePasswordDialog itself stays mounted permanently in the Header, so
// resetting state "on open" would otherwise require exactly the kind of
// setState-in-effect pattern the project's lint rules reject.
export function ChangePasswordDialog({
  open,
  onClose,
}: ChangePasswordDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña">
      {open ? <ChangePasswordForm onClose={onClose} /> : null}
    </Modal>
  )
}

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { userId } = useAuth()
  const mutation = useChangePassword(userId)
  const [rootError, setRootError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '' },
  })

  async function handleSubmit(values: ChangePasswordFormValues) {
    setRootError(null)

    const payload: ChangePasswordPayload = {
      current_password: values.current_password,
      new_password: values.new_password,
    }

    try {
      await mutation.mutateAsync(payload)
      setSuccess(true)
      form.reset({ current_password: '', new_password: '' })
    } catch (error) {
      setRootError(
        extractErrorDetail(error, 'No se pudo cambiar la contraseña.'),
      )
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">
          Tu contraseña se actualizó correctamente.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="change-password-current"
          className="block text-sm font-medium text-ink"
        >
          Contraseña actual
        </label>
        <Input
          id="change-password-current"
          type="password"
          className="mt-1"
          error={Boolean(form.formState.errors.current_password)}
          {...form.register('current_password')}
        />
        {form.formState.errors.current_password ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.current_password.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="change-password-new"
          className="block text-sm font-medium text-ink"
        >
          Contraseña nueva
        </label>
        <Input
          id="change-password-new"
          type="password"
          className="mt-1"
          error={Boolean(form.formState.errors.new_password)}
          {...form.register('new_password')}
        />
        {form.formState.errors.new_password ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {form.formState.errors.new_password.message}
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
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
