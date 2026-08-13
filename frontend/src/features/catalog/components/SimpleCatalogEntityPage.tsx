import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Table } from '../../../components/ui/Table'
import type { TableColumn } from '../../../components/ui/Table'
import { Skeleton } from '../../../components/ui/Skeleton'
import { EmptyState } from '../../../components/feedback/EmptyState'
import { useSimpleCatalogEntity } from '../hooks/useSimpleCatalogEntity'
import { isForbidden, extractErrorDetail } from '../errors'
import type { SimpleEntity, SimpleEntityApi } from '../types/simpleEntity'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

// Mirrors BrandCreate/CategoryCreate: name, min_length=2, max_length=100 --
// both are byte-identical constraints in the real backend schemas.
const nameSchema = z.object({
  name: z
    .string()
    .min(2, 'Debe tener al menos 2 caracteres.')
    .max(100, 'No puede superar 100 caracteres.'),
})

type NameFormValues = z.infer<typeof nameSchema>

const dateFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export interface SimpleCatalogEntityPageProps<T extends SimpleEntity> {
  title: string
  singularLabel: string
  createLabel: string
  searchPlaceholder: string
  emptyTitle: string
  queryKeyName: string
  entityApi: SimpleEntityApi<T>
}

export function SimpleCatalogEntityPage<T extends SimpleEntity>({
  title,
  singularLabel,
  createLabel,
  searchPlaceholder,
  emptyTitle,
  queryKeyName,
  entityApi,
}: SimpleCatalogEntityPageProps<T>) {
  const { listQuery, createMutation, updateMutation, deleteMutation } =
    useSimpleCatalogEntity(queryKeyName, entityApi)

  const [search, setSearch] = useState('')
  const [editingEntity, setEditingEntity] = useState<T | null | 'new'>(null)
  const [deletingEntity, setDeletingEntity] = useState<T | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const form = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: '' },
  })

  const rows = useMemo(() => {
    const all = listQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter((item) => item.name.toLowerCase().includes(term))
  }, [listQuery.data, search])

  function openCreateModal() {
    form.reset({ name: '' })
    setEditingEntity('new')
  }

  function openEditModal(entity: T) {
    form.reset({ name: entity.name })
    setEditingEntity(entity)
  }

  function closeModal() {
    setEditingEntity(null)
    form.reset({ name: '' })
  }

  async function onSubmit(values: NameFormValues) {
    try {
      if (editingEntity === 'new') {
        await createMutation.mutateAsync({ name: values.name })
      } else if (editingEntity) {
        await updateMutation.mutateAsync({
          id: editingEntity.id,
          name: values.name,
        })
      }
      closeModal()
    } catch (error) {
      form.setError('root', {
        message: extractErrorDetail(
          error,
          'No se pudo guardar. Intenta nuevamente.',
        ),
      })
    }
  }

  async function confirmDelete() {
    if (!deletingEntity) return

    setDeleteError(null)

    try {
      await deleteMutation.mutateAsync(deletingEntity.id)
      setDeletingEntity(null)
    } catch (error) {
      setDeleteError(
        extractErrorDetail(error, 'No se pudo eliminar. Intenta nuevamente.'),
      )
    }
  }

  const columns: TableColumn<T>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    {
      key: 'updated_at',
      header: 'Actualizado',
      render: (row) => dateFormatter.format(new Date(row.updated_at)),
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
              setDeletingEntity(row)
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(listQuery.error)

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            {createLabel}
          </Button>
        }
      />

      <div className="mt-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-sm"
          aria-label={searchPlaceholder}
        />
      </div>

      <div className="mt-4">
        {listQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title={`No tienes permiso para ver ${title.toLowerCase()}`}
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : listQuery.isError ? (
          <EmptyState title={`No se pudo cargar ${title.toLowerCase()}`} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={emptyTitle}
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
        open={editingEntity !== null}
        onClose={closeModal}
        title={
          editingEntity === 'new' ? createLabel : `Editar ${singularLabel}`
        }
      >
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="entity-name"
              className="block text-sm font-medium text-ink"
            >
              Nombre
            </label>
            <Input
              id="entity-name"
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

          {form.formState.errors.root ? (
            <p role="alert" className="text-sm text-danger">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <DeleteConfirmDialog
        open={deletingEntity !== null}
        description={`¿Seguro que deseas eliminar "${deletingEntity?.name}"? Esta acción la desactiva, no borra su historial.`}
        onCancel={() => setDeletingEntity(null)}
        onConfirm={confirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteError}
      />
    </>
  )
}
