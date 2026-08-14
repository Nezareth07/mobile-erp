import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { usePermissionsQuery } from './hooks/usePermissions'
import { isForbidden } from './errors'
import { groupPermissionsByModule } from './permissionGrouping'

// Read-only by design: the backend has no create/update/delete endpoint
// for permissions (confirmed during the F11 audit), only
// GET /api/v1/permissions.
export function PermissionsPage() {
  const permissionsQuery = usePermissionsQuery()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const all = permissionsQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter(
      (permission) =>
        permission.code.toLowerCase().includes(term) ||
        (permission.description ?? '').toLowerCase().includes(term),
    )
  }, [permissionsQuery.data, search])

  const groups = groupPermissionsByModule(filtered)
  const forbidden = isForbidden(permissionsQuery.error)

  return (
    <>
      <PageHeader
        title="Permisos"
        description="Catálogo de permisos del sistema. Se asignan a roles desde la pestaña Roles."
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código o descripción…"
          className="max-w-sm"
          aria-label="Buscar por código o descripción"
        />
      </div>

      <div className="mt-4 space-y-4">
        {permissionsQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver permisos"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : permissionsQuery.isError ? (
          <EmptyState title="No se pudieron cargar los permisos" />
        ) : groups.length === 0 ? (
          <EmptyState title="No hay permisos que coincidan con la búsqueda" />
        ) : (
          groups.map((group) => (
            <Card key={group.module} className="p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {group.module}
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="border-b border-line">
                    <tr>
                      <th className="px-2 py-2 font-medium text-ink-muted">
                        Código
                      </th>
                      <th className="px-2 py-2 font-medium text-ink-muted">
                        Descripción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {group.items.map((permission) => (
                      <tr key={permission.id}>
                        <td className="px-2 py-2 font-mono text-xs text-ink">
                          {permission.code}
                        </td>
                        <td className="px-2 py-2 text-ink">
                          {permission.description ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  )
}
