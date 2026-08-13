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
import { ProductForm } from './components/ProductForm'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import {
  useCreateProduct,
  useDeleteProduct,
  useProductsQuery,
  useUpdateProduct,
} from './hooks/useProducts'
import { isForbidden, extractErrorDetail } from './errors'
import { formatCurrency } from './format'
import type { Product, ProductCreatePayload } from './types/catalog'

export function ProductsPage() {
  const productsQuery = useProductsQuery()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = productsQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term),
    )
  }, [productsQuery.data, search])

  function openCreateModal() {
    setFormError(null)
    setEditingProduct('new')
  }

  function openEditModal(product: Product) {
    setFormError(null)
    setEditingProduct(product)
  }

  function closeModal() {
    setEditingProduct(null)
  }

  async function handleSubmit(payload: ProductCreatePayload) {
    try {
      if (editingProduct === 'new') {
        await createMutation.mutateAsync(payload)
      } else if (editingProduct) {
        await updateMutation.mutateAsync({ id: editingProduct.id, payload })
      }
      closeModal()
    } catch (error) {
      setFormError(
        extractErrorDetail(error, 'No se pudo guardar. Intenta nuevamente.'),
      )
    }
  }

  async function confirmDelete() {
    if (!deletingProduct) return

    setDeleteError(null)

    try {
      await deleteMutation.mutateAsync(deletingProduct.id)
      setDeletingProduct(null)
    } catch (error) {
      setDeleteError(
        extractErrorDetail(error, 'No se pudo eliminar. Intenta nuevamente.'),
      )
    }
  }

  const columns: TableColumn<Product>[] = [
    { key: 'name', header: 'Nombre', render: (row) => row.name },
    { key: 'sku', header: 'SKU', render: (row) => row.sku },
    { key: 'brand', header: 'Marca', render: (row) => row.brand.name },
    {
      key: 'category',
      header: 'Categoría',
      render: (row) => row.category.name,
    },
    {
      key: 'sale_price',
      header: 'Precio de venta',
      render: (row) => formatCurrency(row.sale_price),
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
              setDeletingProduct(row)
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  const forbidden = isForbidden(productsQuery.error)

  return (
    <>
      <PageHeader
        title="Productos"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo producto
          </Button>
        }
      />

      <div className="mt-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o SKU…"
          className="max-w-sm"
          aria-label="Buscar por nombre o SKU"
        />
      </div>

      <div className="mt-4">
        {productsQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver productos"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : productsQuery.isError ? (
          <EmptyState title="No se pudieron cargar los productos" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay productos todavía"
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
        open={editingProduct !== null}
        onClose={closeModal}
        title={editingProduct === 'new' ? 'Nuevo producto' : 'Editar producto'}
      >
        <ProductForm
          defaultValues={
            editingProduct && editingProduct !== 'new'
              ? editingProduct
              : undefined
          }
          submitting={createMutation.isPending || updateMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <DeleteConfirmDialog
        open={deletingProduct !== null}
        description={`¿Seguro que deseas eliminar "${deletingProduct?.name}"? Esta acción lo desactiva, no borra su historial.`}
        onCancel={() => setDeletingProduct(null)}
        onConfirm={confirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteError}
      />
    </>
  )
}
