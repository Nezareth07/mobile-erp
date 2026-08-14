import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useAssignRolePermissions, useRoleQuery } from '../hooks/useRoles'
import { usePermissionsQuery } from '../hooks/usePermissions'
import { extractErrorDetail } from '../errors'
import { groupPermissionsByModule } from '../permissionGrouping'

export interface AssignPermissionsDialogProps {
  open: boolean
  roleId: string | null
  roleName: string
  onClose: () => void
}

// The body is a separate component mounted only while the dialog is open
// for a given role, so every open starts from a fresh instance instead of
// needing an effect to manually reset local state on close (this project's
// lint rules reject synchronous setState-in-effect "reset" patterns).
// PUT /roles/{id}/permissions replaces the role's full permission set (not
// incremental), so the checklist never renders and Save never enables
// until the role's *current* permissions have been freshly fetched -- see
// F11 design point 6.
export function AssignPermissionsDialog({
  open,
  roleId,
  roleName,
  onClose,
}: AssignPermissionsDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Asignar permisos a ${roleName}`}
    >
      {open && roleId ? (
        <AssignPermissionsDialogBody roleId={roleId} onClose={onClose} />
      ) : null}
    </Modal>
  )
}

function AssignPermissionsDialogBody({
  roleId,
  onClose,
}: {
  roleId: string
  onClose: () => void
}) {
  const roleQuery = useRoleQuery(roleId)
  const permissionsQuery = usePermissionsQuery()
  const assignMutation = useAssignRolePermissions()

  const [hydratedFrom, setHydratedFrom] = useState<typeof roleQuery.data>(
    undefined,
  )
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)

  // Hydrates the checklist from the freshly-fetched role exactly once,
  // the first time the data becomes available -- set during render (the
  // React-documented way to "adjust state when a value changes" without an
  // effect), not in a useEffect, per this project's lint rules. TanStack
  // Query's structural sharing keeps `roleQuery.data` referentially stable
  // across refetches that return the same content, so this never re-fires
  // on unrelated re-renders once hydrated.
  if (roleQuery.data && roleQuery.data !== hydratedFrom) {
    setHydratedFrom(roleQuery.data)
    setSelected(
      new Set(roleQuery.data.permissions.map((permission) => permission.id)),
    )
  }

  function togglePermission(id: string) {
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

  const loading = roleQuery.isPending || permissionsQuery.isPending
  const hydrated = selected !== null
  const loadFailed = roleQuery.isError || permissionsQuery.isError
  const canSubmit = hydrated && !loading && !loadFailed && !assignMutation.isPending

  const groups = groupPermissionsByModule(permissionsQuery.data ?? [])

  async function handleSubmit() {
    if (!selected) return

    setRootError(null)

    try {
      await assignMutation.mutateAsync({
        id: roleId,
        payload: { permission_ids: Array.from(selected) },
      })
      onClose()
    } catch (error) {
      setRootError(
        extractErrorDetail(error, 'No se pudieron guardar los permisos.'),
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
          No se pudieron cargar los permisos actuales. Cierra e intenta de
          nuevo.
        </p>
      ) : (
        <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border border-line p-3">
          {groups.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No hay permisos disponibles.
            </p>
          ) : (
            groups.map((group) => (
              <fieldset key={group.module}>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.module}
                </legend>
                <div className="mt-1 space-y-1">
                  {group.items.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-center gap-2 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={selected?.has(permission.id) ?? false}
                        onChange={() => togglePermission(permission.id)}
                        className="h-4 w-4 rounded border-line text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      {permission.code}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))
          )}
        </div>
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
