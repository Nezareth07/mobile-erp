import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { DateRangePicker } from './components/DateRangePicker'
import { todayIsoDate } from './dateRange'
import type { DateRange } from './dateRange'
import {
  useInventoryMovementsQuery,
  useProductOptionsQuery,
} from './hooks/useInventory'
import { isForbidden } from './errors'
import { formatCurrency } from './format'
import type { InventoryMovementItem, MovementType } from './types/inventory'

// Duplicated from features/dashboard/components/RecentActivityList.tsx
// (closed phase F4) -- same movement-type vocabulary, different page.
const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase_in: 'Compra',
  sale_out: 'Venta',
  adjustment_in: 'Ajuste (entrada)',
  adjustment_out: 'Ajuste (salida)',
  return_in: 'Devolución (entrada)',
  return_out: 'Devolución (salida)',
  warranty_out: 'Garantía (salida)',
  warranty_in: 'Garantía (entrada)',
  transfer_in: 'Transferencia (entrada)',
  transfer_out: 'Transferencia (salida)',
}

const INBOUND_TYPES: ReadonlySet<MovementType> = new Set([
  'purchase_in',
  'adjustment_in',
  'return_in',
  'warranty_in',
  'transfer_in',
])

function movementVariant(type: MovementType): BadgeVariant {
  return INBOUND_TYPES.has(type) ? 'success' : 'danger'
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const PAGE_SIZE = 20

// location_id is a valid filter on GET /reports/inventory/movements, but
// there is no endpoint to list locations (F7 design decision 2 applies
// here too) -- omitted from the UI rather than hardcoding the single
// seeded location.
export function MovementsPage() {
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayIsoDate()
    return { dateFrom: today, dateTo: today }
  })
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState('')
  const [offset, setOffset] = useState(0)

  const productsQuery = useProductOptionsQuery()
  const movementsQuery = useInventoryMovementsQuery({
    range,
    productId: productId || undefined,
    movementType: movementType || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  function resetPage() {
    setOffset(0)
  }

  const columns: TableColumn<InventoryMovementItem>[] = [
    { key: 'product', header: 'Producto', render: (row) => row.product.name },
    {
      key: 'movement_type',
      header: 'Tipo',
      render: (row) => (
        <Badge variant={movementVariant(row.movement_type)}>
          {MOVEMENT_LABELS[row.movement_type]}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (row) => (row.quantity !== null ? String(row.quantity) : '—'),
    },
    {
      key: 'unit_cost',
      header: 'Costo unitario',
      render: (row) => formatCurrency(row.unit_cost),
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (row) => row.location.name,
    },
    {
      key: 'created_at',
      header: 'Fecha',
      render: (row) => dateTimeFormatter.format(new Date(row.created_at)),
    },
  ]

  const forbidden = isForbidden(movementsQuery.error)
  const rows = movementsQuery.data ?? []

  return (
    <>
      <PageHeader title="Movimientos" description="Historial de inventario" />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <DateRangePicker
          value={range}
          onChange={(value) => {
            setRange(value)
            resetPage()
          }}
        />

        <div>
          <label
            htmlFor="movements-product"
            className="mb-1 block text-xs font-medium text-ink-muted"
          >
            Producto
          </label>
          <Select
            id="movements-product"
            className="w-48"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value)
              resetPage()
            }}
          >
            <option value="">Todos</option>
            {(productsQuery.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="movements-type"
            className="mb-1 block text-xs font-medium text-ink-muted"
          >
            Tipo de movimiento
          </label>
          <Select
            id="movements-type"
            className="w-48"
            value={movementType}
            onChange={(event) => {
              setMovementType(event.target.value)
              resetPage()
            }}
          >
            <option value="">Todos</option>
            {(Object.entries(MOVEMENT_LABELS) as [MovementType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {movementsQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver los movimientos"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : movementsQuery.isError ? (
          <EmptyState title="No se pudieron cargar los movimientos" />
        ) : rows.length === 0 ? (
          <EmptyState title="Sin movimientos en el rango y filtros seleccionados" />
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
