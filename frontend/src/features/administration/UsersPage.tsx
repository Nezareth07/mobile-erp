import { useMemo, useState } from 'react'
import { Ban, Pencil, Plus, UserCog } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { UserForm } from './components/UserForm'
import { AssignRolesDialog } from './components/AssignRolesDialog'
import { DeactivateConfirmDialog } from './components/DeactivateConfirmDialog'
import {
  useCreateUser,
  useDeactivateUser,
  useUpdateUser,
  useUsersQuery,
} from './hooks/useUsers'
import { useRolesQuery } from './hooks/useRoles'
import { isForbidden, extractErrorDetail } from './errors'
import type { User, UserCreatePayload, UserUpdatePayload } from './types/user'

export function UsersPage() {
  const usersQuery = useUsersQuery()
  const rolesQuery = useRolesQuery()
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deactivateMutation = useDeactivateUser()

  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | 'new' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [assigningUser, setAssigningUser] = useState<User | null>(null)
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = usersQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter(
      (user) =>
        user.full_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term),
    )
  }, [usersQuery.data, search])

  function openCreateModal() {
    setFormError(null)
    setEditingUser('new')
  }

  function openEditModal(user: User) {
    setFormError(null)
    setEditingUser(user)
  }

  function closeModal() {
    setEditingUser(null)
  }

  async function handleSubmit(payload: UserCreatePayload | UserUpdatePayload) {
    try {
      if (editingUser === 'new') {
        await createMutation.mutateAsync(payload as UserCreatePayload)
      } else if (editingUser) {
        await updateMutation.mutateAsync({
          id: editingUser.id,
          payload: payload as UserUpdatePayload,
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
    if (!deactivatingUser) return

    setDeactivateError(null)

    try {
      await deactivateMutation.mutateAsync(deactivatingUser.id)
      setDeactivatingUser(null)
    } catch (error) {
      setDeactivateError(
        extractErrorDetail(error, 'No se pudo desactivar. Intenta nuevamente.'),
      )
    }
  }

  const columns: TableColumn<User>[] = [
    { key: 'full_name', header: 'Nombre', render: (row) => row.full_name },
    { key: 'email', header: 'Email', render: (row) => row.email },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) =>
        row.roles.length === 0 ? (
          '—'
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role.id} variant="info">
                {role.name}
              </Badge>
            ))}
          </span>
        ),
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
            aria-label={`Asignar roles a ${row.full_name}`}
            onClick={() => setAssigningUser(row)}
          >
            <UserCog size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${row.full_name}`}
            onClick={() => openEditModal(row)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Desactivar ${row.full_name}`}
            onClick={() => {
              setDeactivateError(null)
              setDeactivatingUser(row)
            }}
          >
            <Ban size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(usersQuery.error)

  return (
    <>
      <PageHeader
        title="Usuarios"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo usuario
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o email…"
          className="max-w-sm"
          aria-label="Buscar por nombre o email"
        />
      </div>

      <div className="mt-4">
        {usersQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver usuarios"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : usersQuery.isError ? (
          <EmptyState title="No se pudieron cargar los usuarios" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay usuarios todavía"
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
        open={editingUser !== null}
        onClose={closeModal}
        title={editingUser === 'new' ? 'Nuevo usuario' : 'Editar usuario'}
      >
        <UserForm
          defaultValues={
            editingUser && editingUser !== 'new' ? editingUser : undefined
          }
          availableRoles={rolesQuery.data ?? []}
          submitting={createMutation.isPending || updateMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <AssignRolesDialog
        open={assigningUser !== null}
        userId={assigningUser?.id ?? null}
        userName={assigningUser?.full_name ?? ''}
        onClose={() => setAssigningUser(null)}
      />

      <DeactivateConfirmDialog
        open={deactivatingUser !== null}
        entityLabel={`el usuario "${deactivatingUser?.full_name}"`}
        onCancel={() => setDeactivatingUser(null)}
        onConfirm={confirmDeactivate}
        submitting={deactivateMutation.isPending}
        error={deactivateError}
      />
    </>
  )
}
