import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { usePurchaseQuery } from './hooks/usePurchases'
import { isForbidden, isNotFound } from './errors'
import { formatCurrency, formatDate } from './format'
import type { PurchaseLine, PurchaseStatus } from './types/purchase'

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

function statusVariant(status: PurchaseStatus): BadgeVariant {
  return status === 'confirmed' ? 'success' : 'danger'
}

export function PurchaseDetailPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const id = purchaseId ?? ''

  const purchaseQuery = usePurchaseQuery(id)
  const purchase = purchaseQuery.data

  const forbidden = isForbidden(purchaseQuery.error)
  const notFound = isNotFound(purchaseQuery.error)

  const columns: TableColumn<PurchaseLine>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (row) => `${row.product.name} (${row.product.sku})`,
    },
    { key: 'quantity', header: 'Cantidad', render: (row) => String(row.quantity) },
    {
      key: 'unit_cost',
      header: 'Costo unitario',
      render: (row) => formatCurrency(row.unit_cost),
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      render: (row) => formatCurrency(row.subtotal),
    },
    {
      key: 'identifier',
      header: 'IMEI / Lote',
      render: (row) => row.imei ?? row.lot_code ?? '—',
    },
  ]

  return (
    <>
      <Link
        to="/compras"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Compras
      </Link>

      <PageHeader
        className="mt-2"
        title={purchase ? `Compra a ${purchase.supplier.name}` : 'Detalle de compra'}
        description={purchase ? formatDate(purchase.purchase_date) : undefined}
      />

      <div className="mt-4">
        {purchaseQuery.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver esta compra"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : notFound ? (
          <EmptyState title="Compra no encontrada" />
        ) : purchaseQuery.isError ? (
          <EmptyState title="No se pudo cargar la compra" />
        ) : purchase ? (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Estado</p>
                  <Badge variant={statusVariant(purchase.status)}>
                    {STATUS_LABELS[purchase.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">Ubicación</p>
                  <p className="text-sm text-ink">{purchase.location.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">
                    Nº de factura
                  </p>
                  <p className="text-sm text-ink">
                    {purchase.invoice_number ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">
                    Costo total
                  </p>
                  <p className="text-lg font-semibold text-ink">
                    {formatCurrency(purchase.total_cost)}
                  </p>
                </div>
              </div>
              {purchase.notes ? (
                <p className="mt-4 text-sm text-ink-muted">{purchase.notes}</p>
              ) : null}
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="text-sm font-semibold text-ink">Líneas</h2>
              <div className="mt-3">
                <Table
                  columns={columns}
                  rows={purchase.lines}
                  rowKey={(row) => row.id}
                />
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  )
}
