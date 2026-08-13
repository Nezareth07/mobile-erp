import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { SupplierForm } from './components/SupplierForm'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliersQuery,
  useUpdateSupplier,
} from './hooks/useSuppliers'
import { isForbidden, extractErrorDetail } from './errors'
import type { Supplier, SupplierCreatePayload } from './types/supplier'

export function SuppliersPage() {
  const suppliersQuery = useSuppliersQuery()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

  const [search, setSearch] = useState('')
  const [editingSupplier, setEditingSupplier] = useState<
    Supplier | 'new' | null
  >(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = suppliersQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter((supplier) =>
      supplier.name.toLowerCase().includes(term),
    )
  }, [suppliersQuery.data, search])

  function openCreateModal() {
    setFormError(null)
    setEditingSupplier('new')
  }

  function openEditModal(supplier: Supplier) {
    setFormError(null)
    setEditingSupplier(supplier)
  }

  function closeModal() {
    setEditingSupplier(null)
  }

  async function handleSubmit(payload: SupplierCreatePayload) {
    try {
      if (editingSupplier === 'new') {
        await createMutation.mutateAsync(payload)
      } else if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, payload })
      }
      closeModal()
    } catch (error) {
      setFormError(
        extractErrorDetail(error, 'No se pudo guardar. Intenta nuevamente.'),
      )
    }
  }

  async function confirmDelete() {
    if (!deletingSupplier) return

    setDeleteError(null)

    try {
      await deleteMutation.mutateAsync(deletingSupplier.id)
      setDeletingSupplier(null)
    } catch (error) {
      setDeleteError(
        extractErrorDetail(error, 'No se pudo eliminar. Intenta nuevamente.'),
      )
    }
  }

  const columns: TableColumn<Supplier>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    {
      key: 'contact_name',
      header: 'Contacto',
      render: (row) => row.contact_name ?? '—',
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
              setDeletingSupplier(row)
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(suppliersQuery.error)

  return (
    <>
      <PageHeader
        title="Proveedores"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo proveedor
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

      <div className="mt-4">
        {suppliersQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver proveedores"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : suppliersQuery.isError ? (
          <EmptyState title="No se pudieron cargar los proveedores" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay proveedores todavía"
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
        open={editingSupplier !== null}
        onClose={closeModal}
        title={
          editingSupplier === 'new' ? 'Nuevo proveedor' : 'Editar proveedor'
        }
      >
        <SupplierForm
          defaultValues={
            editingSupplier && editingSupplier !== 'new'
              ? editingSupplier
              : undefined
          }
          submitting={createMutation.isPending || updateMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <DeleteConfirmDialog
        open={deletingSupplier !== null}
        description={`¿Seguro que deseas eliminar "${deletingSupplier?.name}"? Esta acción lo desactiva, no borra su historial.`}
        onCancel={() => setDeletingSupplier(null)}
        onConfirm={confirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteError}
      />
    </>
  )
}
