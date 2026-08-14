import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { usePurchasesQuery, useSupplierOptionsQuery } from './hooks/usePurchases'
import { isForbidden } from './errors'
import { formatCurrency, formatDate } from './format'
import type { Purchase, PurchaseStatus } from './types/purchase'

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

function statusVariant(status: PurchaseStatus): BadgeVariant {
  return status === 'confirmed' ? 'success' : 'danger'
}

const PAGE_SIZE = 20

export function PurchasesPage() {
  const navigate = useNavigate()
  const [supplierId, setSupplierId] = useState('')
  const [offset, setOffset] = useState(0)

  const supplierOptionsQuery = useSupplierOptionsQuery()
  const purchasesQuery = usePurchasesQuery({
    supplierId: supplierId || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  const rows = purchasesQuery.data ?? []
  const forbidden = isForbidden(purchasesQuery.error)

  const columns: TableColumn<Purchase>[] = [
    {
      key: 'supplier',
      header: 'Proveedor',
      render: (row) => row.supplier.name,
    },
    {
      key: 'purchase_date',
      header: 'Fecha',
      render: (row) => formatDate(row.purchase_date),
    },
    {
      key: 'lines',
      header: 'Líneas',
      render: (row) => String(row.lines.length),
    },
    {
      key: 'total_cost',
      header: 'Costo total',
      render: (row) => formatCurrency(row.total_cost),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/compras/${row.id}`)}
        >
          Ver detalle
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Compras"
        actions={
          <Button size="sm" onClick={() => navigate('/compras/nueva')}>
            <Plus size={16} aria-hidden="true" />
            Nueva compra
          </Button>
        }
      />

      <div className="mt-4">
        <label
          htmlFor="purchases-supplier-filter"
          className="mb-1 block text-xs font-medium text-ink-muted"
        >
          Proveedor
        </label>
        <Select
          id="purchases-supplier-filter"
          className="w-64"
          value={supplierId}
          onChange={(event) => {
            setSupplierId(event.target.value)
            setOffset(0)
          }}
        >
          <option value="">Todos</option>
          {(supplierOptionsQuery.data ?? []).map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        {purchasesQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver compras"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : purchasesQuery.isError ? (
          <EmptyState title="No se pudieron cargar las compras" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay compras todavía"
            action={
              <Button size="sm" onClick={() => navigate('/compras/nueva')}>
                Registrar la primera
              </Button>
            }
          />
        ) : (
          <>
            <Table columns={columns} rows={rows} rowKey={(row) => row.id} />
            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={rows.length < PAGE_SIZE}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Siguiente
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
