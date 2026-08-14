import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/feedback/EmptyState'
import { getUnitByImei } from './api'
import { useStockValuationQuery } from './hooks/useInventory'
import { isForbidden, extractErrorDetail } from './errors'
import { formatCurrency } from './format'
import type { StockValuationLine, TrackingType } from './types/inventory'

const TRACKING_LABELS: Record<TrackingType, string> = {
  none: 'Sin seguimiento',
  serial: 'Serial (IMEI)',
  batch: 'Lote',
}

export function InventoryPage() {
  const navigate = useNavigate()
  const valuationQuery = useStockValuationQuery()

  const [search, setSearch] = useState('')
  const [imei, setImei] = useState('')
  const [imeiError, setImeiError] = useState<string | null>(null)
  const [imeiSearching, setImeiSearching] = useState(false)

  const rows = useMemo(() => {
    const all = valuationQuery.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) return all

    return all.filter(
      (line) =>
        line.product.name.toLowerCase().includes(term) ||
        line.product.sku.toLowerCase().includes(term),
    )
  }, [valuationQuery.data, search])

  async function handleImeiSearch(event: FormEvent) {
    event.preventDefault()

    const term = imei.trim()
    if (!term) return

    setImeiError(null)
    setImeiSearching(true)

    try {
      const unit = await getUnitByImei(term)
      navigate(`/inventario/${unit.product_id}`)
    } catch (error) {
      setImeiError(
        extractErrorDetail(error, 'No se pudo buscar el IMEI.'),
      )
    } finally {
      setImeiSearching(false)
    }
  }

  const columns: TableColumn<StockValuationLine>[] = [
    { key: 'name', header: 'Producto', render: (row) => row.product.name },
    { key: 'sku', header: 'SKU', render: (row) => row.product.sku },
    {
      key: 'tracking_type',
      header: 'Tipo',
      render: (row) => TRACKING_LABELS[row.tracking_type],
    },
    {
      key: 'quantity_on_hand',
      header: 'Cantidad disponible',
      render: (row) => String(row.quantity_on_hand),
    },
    {
      key: 'total_value',
      header: 'Valor total',
      render: (row) => formatCurrency(row.total_value),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/inventario/${row.product.id}`)}
        >
          Ver detalle
        </Button>
      ),
    },
  ]

  const forbidden = isForbidden(valuationQuery.error)

  return (
    <>
      <PageHeader title="Inventario" description="Valuación de stock actual" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o SKU…"
          className="max-w-sm"
          aria-label="Buscar por nombre o SKU"
        />

        <form onSubmit={handleImeiSearch} className="flex items-start gap-2">
          <div>
            <Input
              value={imei}
              onChange={(event) => setImei(event.target.value)}
              placeholder="Buscar por IMEI…"
              className="max-w-xs"
              aria-label="Buscar por IMEI"
            />
            {imeiError ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {imeiError}
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="secondary" disabled={imeiSearching}>
            <Search size={16} aria-hidden="true" />
            Buscar
          </Button>
        </form>
      </div>

      <div className="mt-4">
        {valuationQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : forbidden ? (
          <EmptyState
            title="No tienes permiso para ver el inventario"
            description="Contacta a un administrador si crees que esto es un error."
          />
        ) : valuationQuery.isError ? (
          <EmptyState title="No se pudo cargar la valuación de inventario" />
        ) : rows.length === 0 ? (
          <EmptyState title="No hay stock registrado todavía" />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(row) => row.product.id} />
        )}
      </div>
    </>
  )
}
