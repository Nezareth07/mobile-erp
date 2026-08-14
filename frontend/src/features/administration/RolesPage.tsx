import { useMemo, useState } from 'react'
import { Ban, KeySquare, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { RoleForm } from './components/RoleForm'
import { AssignPermissionsDialog } from './components/AssignPermissionsDialog'
import { DeactivateConfirmDialog } from './components/DeactivateConfirmDialog'
import {
  useCreateRole,
  useDeactivateRole,
  useRolesQuery,
  useUpdateRole,
} from './hooks/useRoles'
import { isForbidden, extractErrorDetail } from './errors'
import type { Role, RoleCreatePayload, RoleUpdatePayload } from './types/role'

export function RolesPage() {
  const rolesQuery = useRolesQuery()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deactivateMutation = useDeactivateRole()

  const [search, setSearch] = useState('')
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [assigningRole, setAssigningRole] = useState<Role | null>(null)
  const [deactivatingRole, setDeactivatingRole] = useState<Role | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = rolesQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter((role) => role.name.toLowerCase().includes(term))
  }, [rolesQuery.data, search])

  function openCreateModal() {
    setFormError(null)
    setEditingRole('new')
  }

  function openEditModal(role: Role) {
    setFormError(null)
    setEditingRole(role)
  }

  function closeModal() {
    setEditingRole(null)
  }

  async function handleSubmit(payload: RoleCreatePayload | RoleUpdatePayload) {
    try {
      if (editingRole === 'new') {
        await createMutation.mutateAsync(payload as RoleCreatePayload)
      } else if (editingRole) {
        await updateMutation.mutateAsync({
          id: editingRole.id,
          payload: payload as RoleUpdatePayload,
        })
      }
      closeModal()
    } catch (error) {
      setFormError(
        extractErrorDetail(error, 'No se pudo guardar. Intenta nuevamente.'),
      )
    }
  }

  async function confirmDeactivate() {
    if (!deactivatingRole) return

    setDeactivateError(null)

    try {
      await deactivateMutation.mutateAsync(deactivatingRole.id)
      setDeactivatingRole(null)
    } catch (error) {
      setDeactivateError(
        extractErrorDetail(error, 'No se pudo desactivar. Intenta nuevamente.'),
      )
    }
  }

  const columns: TableColumn<Role>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    {
      key: 'description',
      header: 'Descripción',
      render: (row) => row.description ?? '—',
    },
    {
      key: 'permissions',
      header: 'Permisos',
      render: (row) => `${row.permissions.length}`,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Asignar permisos a ${row.name}`}
            onClick={() => setAssigningRole(row)}
          >
            <KeySquare size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${row.name}`}
            onClick={() => openEditModal(row)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Desactivar ${row.name}`}
            onClick={() => {
              setDeactivateError(null)
              setDeactivatingRole(row)
            }}
          >
            <Ban size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(rolesQuery.error)

  return (
    <>
      <PageHeader
        title="Roles"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo rol
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre…"
          className="max-w-sm"
          aria-label="Buscar por nombre"
        />
      </div>

      <div className="mt-4">
        {rolesQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver roles"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : rolesQuery.isError ? (
          <EmptyState title="No se pudieron cargar los roles" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay roles todavía"
            action={
              <Button size="sm" onClick={openCreateModal}>
                Crear el primero
              </Button>
            }
          />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(row) => row.id} />
        )}
      </div>

      <Modal
        open={editingRole !== null}
        onClose={closeModal}
        title={editingRole === 'new' ? 'Nuevo rol' : 'Editar rol'}
      >
        <RoleForm
          defaultValues={
            editingRole && editingRole !== 'new' ? editingRole : undefined
          }
          submitting={createMutation.isPending || updateMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <AssignPermissionsDialog
        open={assigningRole !== null}
        roleId={assigningRole?.id ?? null}
        roleName={assigningRole?.name ?? ''}
        onClose={() => setAssigningRole(null)}
      />

      <DeactivateConfirmDialog
        open={deactivatingRole !== null}
        entityLabel={`el rol "${deactivatingRole?.name}"`}
        onCancel={() => setDeactivatingRole(null)}
        onConfirm={confirmDeactivate}
        submitting={deactivateMutation.isPending}
        error={deactivateError}
      />
    </>
  )
}
