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
import { useCustomerOptionsQuery, useSalesQuery } from './hooks/useSales'
import { isForbidden } from './errors'
import { formatCurrency, formatDate } from './format'
import type { Sale, SaleStatus } from './types/sale'

const STATUS_LABELS: Record<SaleStatus, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

function statusVariant(status: SaleStatus): BadgeVariant {
  return status === 'confirmed' ? 'success' : 'danger'
}

const PAGE_SIZE = 20

export function SalesPage() {
  const navigate = useNavigate()
  const [customerId, setCustomerId] = useState('')
  const [offset, setOffset] = useState(0)

  const customerOptionsQuery = useCustomerOptionsQuery()
  const salesQuery = useSalesQuery({
    customerId: customerId || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  const rows = salesQuery.data ?? []
  const forbidden = isForbidden(salesQuery.error)

  const columns: TableColumn<Sale>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => row.customer.name,
    },
    {
      key: 'sale_date',
      header: 'Fecha',
      render: (row) => formatDate(row.sale_date),
    },
    {
      key: 'lines',
      header: 'Líneas',
      render: (row) => String(row.lines.length),
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => formatCurrency(row.total_amount),
    },
    {
      key: 'profit',
      header: 'Utilidad',
      render: (row) => formatCurrency(row.profit),
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
          onClick={() => navigate(`/ventas/${row.id}`)}
        >
          Ver detalle
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Ventas"
        actions={
          <Button size="sm" onClick={() => navigate('/ventas/nueva')}>
            <Plus size={16} aria-hidden="true" />
            Nueva venta
          </Button>
        }
      />

      <div className="mt-4">
        <label
          htmlFor="sales-customer-filter"
          className="mb-1 block text-xs font-medium text-ink-muted"
        >
          Cliente
        </label>
        <Select
          id="sales-customer-filter"
          className="w-64"
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value)
            setOffset(0)
          }}
        >
          <option value="">Todos</option>
          {(customerOptionsQuery.data ?? []).map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        {salesQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver ventas"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : salesQuery.isError ? (
          <EmptyState title="No se pudieron cargar las ventas" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No hay ventas todavía"
            action={
              <Button size="sm" onClick={() => navigate('/ventas/nueva')}>
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
