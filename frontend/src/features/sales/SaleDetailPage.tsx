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
import { useSaleQuery } from './hooks/useSales'
import { isForbidden, isNotFound } from './errors'
import { formatCurrency, formatDate } from './format'
import type { SaleLine, SaleStatus } from './types/sale'

const STATUS_LABELS: Record<SaleStatus, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

function statusVariant(status: SaleStatus): BadgeVariant {
  return status === 'confirmed' ? 'success' : 'danger'
}

export function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>()
  const id = saleId ?? ''

  const saleQuery = useSaleQuery(id)
  const sale = saleQuery.data

  const forbidden = isForbidden(saleQuery.error)
  const notFound = isNotFound(saleQuery.error)

  const columns: TableColumn<SaleLine>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (row) => `${row.product.name} (${row.product.sku})`,
    },
    { key: 'quantity', header: 'Cantidad', render: (row) => String(row.quantity) },
    {
      key: 'unit_price',
      header: 'Precio unitario',
      render: (row) => formatCurrency(row.unit_price),
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      render: (row) => formatCurrency(row.subtotal),
    },
    {
      key: 'imei',
      header: 'IMEI',
      render: (row) => row.imei ?? '—',
    },
  ]

  return (
    <>
      <Link
        to="/ventas"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Ventas
      </Link>

      <PageHeader
        className="mt-2"
        title={sale ? `Venta a ${sale.customer.name}` : 'Detalle de venta'}
        description={sale ? formatDate(sale.sale_date) : undefined}
      />

      <div className="mt-4">
        {saleQuery.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver esta venta"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : notFound ? (
          <EmptyState title="Venta no encontrada" />
        ) : saleQuery.isError ? (
          <EmptyState title="No se pudo cargar la venta" />
        ) : sale ? (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Estado</p>
                  <Badge variant={statusVariant(sale.status)}>
                    {STATUS_LABELS[sale.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">Ubicación</p>
                  <p className="text-sm text-ink">{sale.location.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">Total</p>
                  <p className="text-lg font-semibold text-ink">
                    {formatCurrency(sale.total_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">Utilidad</p>
                  <p className="text-lg font-semibold text-ink">
                    {formatCurrency(sale.profit)}
                  </p>
                </div>
              </div>
              {sale.notes ? (
                <p className="mt-4 text-sm text-ink-muted">{sale.notes}</p>
              ) : null}
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="text-sm font-semibold text-ink">Líneas</h2>
              <div className="mt-3">
                <Table
                  columns={columns}
                  rows={sale.lines}
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
