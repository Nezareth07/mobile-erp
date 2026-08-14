import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useAssignUserRoles, useUserQuery } from '../hooks/useUsers'
import { useRolesQuery } from '../hooks/useRoles'
import { extractErrorDetail } from '../errors'

export interface AssignRolesDialogProps {
  open: boolean
  userId: string | null
  userName: string
  onClose: () => void
}

// The body is a separate component mounted only while the dialog is open
// for a given user, so every open starts from a fresh instance instead of
// needing an effect to manually reset local state on close (this project's
// lint rules reject synchronous setState-in-effect "reset" patterns).
// PUT /users/{id}/roles replaces the user's full role set (not
// incremental), so the checklist never renders and Save never enables
// until the user's *current* roles have been freshly fetched -- see F11
// design point 6.
export function AssignRolesDialog({
  open,
  userId,
  userName,
  onClose,
}: AssignRolesDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Asignar roles a ${userName}`}
    >
      {open && userId ? (
        <AssignRolesDialogBody userId={userId} onClose={onClose} />
      ) : null}
    </Modal>
  )
}

function AssignRolesDialogBody({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const userQuery = useUserQuery(userId)
  const rolesQuery = useRolesQuery()
  const assignMutation = useAssignUserRoles()

  const [hydratedFrom, setHydratedFrom] = useState<typeof userQuery.data>(
    undefined,
  )
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)

  // Hydrates the checklist from the freshly-fetched user exactly once,
  // the first time the data becomes available -- set during render (the
  // React-documented way to "adjust state when a value changes" without an
  // effect), not in a useEffect, per this project's lint rules. TanStack
  // Query's structural sharing keeps `userQuery.data` referentially stable
  // across refetches that return the same content, so this never re-fires
  // on unrelated re-renders once hydrated.
  if (userQuery.data && userQuery.data !== hydratedFrom) {
    setHydratedFrom(userQuery.data)
    setSelected(new Set(userQuery.data.roles.map((role) => role.id)))
  }

  function toggleRole(id: string) {
    setSelected((current) => {
      if (!current) return current
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const loading = userQuery.isPending || rolesQuery.isPending
  const hydrated = selected !== null
  const loadFailed = userQuery.isError || rolesQuery.isError
  const canSubmit = hydrated && !loading && !loadFailed && !assignMutation.isPending

  async function handleSubmit() {
    if (!selected) return

    setRootError(null)

    try {
      await assignMutation.mutateAsync({
        id: userId,
        payload: { role_ids: Array.from(selected) },
      })
      onClose()
    } catch (error) {
      setRootError(
        extractErrorDetail(error, 'No se pudieron guardar los roles.'),
      )
    }
  }

  return (
    <>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : loadFailed ? (
        <p role="alert" className="text-sm text-danger">
          No se pudieron cargar los roles actuales. Cierra e intenta de
          nuevo.
        </p>
      ) : (
        <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-line p-3">
          <legend className="sr-only">Roles</legend>
          {rolesQuery.data && rolesQuery.data.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No hay roles activos disponibles.
            </p>
          ) : (
            rolesQuery.data?.map((role) => (
              <label
                key={role.id}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={selected?.has(role.id) ?? false}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 rounded border-line text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                {role.name}
              </label>
            ))
          )}
        </fieldset>
      )}

      {rootError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {rootError}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={assignMutation.isPending}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {assignMutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </>
  )
}
