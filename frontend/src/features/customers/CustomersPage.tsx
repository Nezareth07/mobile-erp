import { useMemo, useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { CustomerForm } from './components/CustomerForm'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import {
  useCreateCustomer,
  useCustomersQuery,
  useDeleteCustomer,
  useSetDefaultCustomer,
  useUpdateCustomer,
} from './hooks/useCustomers'
import { isForbidden, extractErrorDetail } from './errors'
import type { Customer, CustomerCreatePayload } from './types/customer'

export function CustomersPage() {
  const customersQuery = useCustomersQuery()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()
  const setDefaultMutation = useSetDefaultCustomer()

  const [search, setSearch] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<
    Customer | 'new' | null
  >(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [defaultError, setDefaultError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = customersQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter((customer) =>
      customer.name.toLowerCase().includes(term),
    )
  }, [customersQuery.data, search])

  function openCreateModal() {
    setFormError(null)
    setEditingCustomer('new')
  }

  function openEditModal(customer: Customer) {
    setFormError(null)
    setEditingCustomer(customer)
  }

  function closeModal() {
    setEditingCustomer(null)
  }

  async function handleSubmit(payload: CustomerCreatePayload) {
    try {
      if (editingCustomer === 'new') {
        await createMutation.mutateAsync(payload)
      } else if (editingCustomer) {
        await updateMutation.mutateAsync({ id: editingCustomer.id, payload })
      }
      closeModal()
    } catch (error) {
      setFormError(
        extractErrorDetail(error, 'No se pudo guardar. Intenta nuevamente.'),
      )
    }
  }

  async function confirmDelete() {
    if (!deletingCustomer) return

    setDeleteError(null)

    try {
      await deleteMutation.mutateAsync(deletingCustomer.id)
      setDeletingCustomer(null)
    } catch (error) {
      setDeleteError(
        extractErrorDetail(error, 'No se pudo eliminar. Intenta nuevamente.'),
      )
    }
  }

  async function handleSetDefault(customer: Customer) {
    setDefaultError(null)

    try {
      await setDefaultMutation.mutateAsync(customer.id)
    } catch (error) {
      setDefaultError(
        extractErrorDetail(
          error,
          'No se pudo marcar como cliente por defecto. Intenta nuevamente.',
        ),
      )
    }
  }

  const columns: TableColumn<Customer>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <span className="flex items-center gap-2">
          {row.name}
          {row.is_default_customer ? (
            <Badge variant="info">Por defecto</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'document_id',
      header: 'Documento',
      render: (row) => row.document_id ?? '—',
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (row) => row.phone ?? '—',
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email ?? '—',
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
            aria-label={
              row.is_default_customer
                ? `${row.name} ya es el cliente por defecto`
                : `Marcar a ${row.name} como cliente por defecto`
            }
            disabled={row.is_default_customer || setDefaultMutation.isPending}
            onClick={() => handleSetDefault(row)}
          >
            <Star
              size={16}
              aria-hidden="true"
              fill={row.is_default_customer ? 'currentColor' : 'none'}
            />
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
            aria-label={`Eliminar ${row.name}`}
            onClick={() => {
              setDeleteError(null)
              setDeletingCustomer(row)
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(customersQuery.error)

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo cliente
          </Button>
        }
      />

      <div className="mt-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre…"
          className="max-w-sm"
          aria-label="Buscar por nombre"
        />
      </div>

      {defaultError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {defaultError}
        </p>
      ) : null}

      <div className="mt-4">
        {customersQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver clientes"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : customersQuery.isError ? (
          <EmptyState title="No se pudieron cargar los clientes" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay clientes todavía"
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
        open={editingCustomer !== null}
        onClose={closeModal}
        title={
          editingCustomer === 'new' ? 'Nuevo cliente' : 'Editar cliente'
        }
      >
        <CustomerForm
          defaultValues={
            editingCustomer && editingCustomer !== 'new'
              ? editingCustomer
              : undefined
          }
          submitting={createMutation.isPending || updateMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <DeleteConfirmDialog
        open={deletingCustomer !== null}
        description={`¿Seguro que deseas eliminar "${deletingCustomer?.name}"? Esta acción lo desactiva, no borra su historial.`}
        onCancel={() => setDeletingCustomer(null)}
        onConfirm={confirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteError}
      />
    </>
  )
}
