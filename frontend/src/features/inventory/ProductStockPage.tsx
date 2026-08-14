import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import type { TableColumn } from '../../components/ui/Table'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/feedback/EmptyState'
import { SerialIntakeForm } from './components/SerialIntakeForm'
import { BatchIntakeForm } from './components/BatchIntakeForm'
import { SerialAdjustmentForm } from './components/SerialAdjustmentForm'
import { BatchAdjustmentForm } from './components/BatchAdjustmentForm'
import {
  useAdjustBatchStock,
  useAdjustSerialStock,
  useAvailableStockQuery,
  useProductQuery,
  useProductUnitsQuery,
  useRegisterBatchIntake,
  useRegisterSerialIntake,
} from './hooks/useInventory'
import { isForbidden, extractErrorDetail } from './errors'
import { formatCurrency } from './format'
import type {
  ProductUnitResponse,
  ProductUnitStatus,
  TrackingType,
} from './types/inventory'

const TRACKING_LABELS: Record<TrackingType, string> = {
  none: 'Sin seguimiento',
  serial: 'Serial (IMEI)',
  batch: 'Lote',
}

const STATUS_LABELS: Record<ProductUnitStatus, string> = {
  in_stock: 'En stock',
  reserved: 'Reservado',
  sold: 'Vendido',
  in_warranty: 'En garantía',
  defective: 'Defectuoso',
  returned_to_supplier: 'Devuelto al proveedor',
}

type ModalKind = 'intake' | 'adjust' | null

export function ProductStockPage() {
  const { productId } = useParams<{ productId: string }>()
  const id = productId ?? ''

  const productQuery = useProductQuery(id)
  const stockQuery = useAvailableStockQuery(id)
  const trackingType = stockQuery.data?.tracking_type

  const [statusFilter, setStatusFilter] = useState<ProductUnitStatus | ''>('')
  const unitsQuery = useProductUnitsQuery(
    id,
    statusFilter || undefined,
    trackingType === 'serial',
  )

  const [modal, setModal] = useState<ModalKind>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const registerSerialIntake = useRegisterSerialIntake(id)
  const registerBatchIntake = useRegisterBatchIntake(id)
  const adjustSerial = useAdjustSerialStock(id)
  const adjustBatch = useAdjustBatchStock(id)

  const forbidden =
    isForbidden(productQuery.error) || isForbidden(stockQuery.error)

  function closeModal() {
    setModal(null)
    setFormError(null)
  }

  const columns: TableColumn<ProductUnitResponse>[] = [
    { key: 'imei', header: 'IMEI', render: (row) => row.imei },
    {
      key: 'imei2',
      header: 'IMEI 2',
      render: (row) => row.imei2 ?? '—',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.status === 'in_stock' ? 'success' : 'neutral'}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'unit_cost',
      header: 'Costo',
      render: (row) => formatCurrency(row.unit_cost),
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (row) => row.location.name,
    },
  ]

  if (!id) {
    return <EmptyState title="Producto no especificado" />
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Stock del producto" />
        <div className="mt-6">
          <EmptyState
            title="No tienes permiso para ver el stock de este producto"
            description="Contacta a un administrador si crees que esto es un error."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Link
        to="/inventario"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Inventario
      </Link>

      <PageHeader
        className="mt-2"
        title={productQuery.data?.name ?? 'Stock del producto'}
        description={productQuery.data ? `SKU ${productQuery.data.sku}` : undefined}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFormError(null)
                setModal('adjust')
              }}
              disabled={!trackingType}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              Ajustar stock
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFormError(null)
                setModal('intake')
              }}
              disabled={!trackingType}
            >
              <Plus size={16} aria-hidden="true" />
              Nueva entrada
            </Button>
          </>
        }
      />

      <Card className="mt-4 p-5">
        {stockQuery.isPending || productQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : stockQuery.isError || productQuery.isError ? (
          <EmptyState title="No se pudo cargar el stock de este producto" />
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs font-medium text-ink-muted">Tipo</p>
              <p className="text-sm text-ink">
                {trackingType ? TRACKING_LABELS[trackingType] : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">
                Cantidad disponible
              </p>
              <p className="text-lg font-semibold text-ink">
                {stockQuery.data?.available_quantity ?? 0}
              </p>
            </div>
          </div>
        )}
      </Card>

      {trackingType === 'serial' ? (
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Unidades</h2>
            <Select
              aria-label="Filtrar por estado"
              className="w-48"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ProductUnitStatus | '')
              }
            >
              <option value="">Todos los estados</option>
              {(Object.entries(STATUS_LABELS) as [ProductUnitStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div className="mt-3">
            {unitsQuery.isPending ? (
              <Spinner label="Cargando unidades" />
            ) : unitsQuery.isError ? (
              <EmptyState title="No se pudieron cargar las unidades" />
            ) : (unitsQuery.data ?? []).length === 0 ? (
              <EmptyState title="Sin unidades para este filtro" />
            ) : (
              <Table
                columns={columns}
                rows={unitsQuery.data ?? []}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </Card>
      ) : null}

      <Modal
        open={modal === 'intake'}
        onClose={closeModal}
        title="Nueva entrada de stock"
      >
        {trackingType === 'serial' ? (
          <SerialIntakeForm
            productId={id}
            submitting={registerSerialIntake.isPending}
            rootError={formError}
            onCancel={closeModal}
            onSubmit={(payload) => {
              registerSerialIntake.mutate(payload, {
                onSuccess: closeModal,
                onError: (error) =>
                  setFormError(
                    extractErrorDetail(
                      error,
                      'No se pudo registrar la entrada. Intenta nuevamente.',
                    ),
                  ),
              })
            }}
          />
        ) : (
          <BatchIntakeForm
            productId={id}
            submitting={registerBatchIntake.isPending}
            rootError={formError}
            onCancel={closeModal}
            onSubmit={(payload) => {
              registerBatchIntake.mutate(payload, {
                onSuccess: closeModal,
                onError: (error) =>
                  setFormError(
                    extractErrorDetail(
                      error,
                      'No se pudo registrar la entrada. Intenta nuevamente.',
                    ),
                  ),
              })
            }}
          />
        )}
      </Modal>

      <Modal open={modal === 'adjust'} onClose={closeModal} title="Ajustar stock">
        {trackingType === 'serial' ? (
          <SerialAdjustmentForm
            productId={id}
            submitting={adjustSerial.isPending}
            rootError={formError}
            onCancel={closeModal}
            onSubmit={(payload) => {
              adjustSerial.mutate(payload, {
                onSuccess: closeModal,
                onError: (error) =>
                  setFormError(
                    extractErrorDetail(
                      error,
                      'No se pudo ajustar el stock. Intenta nuevamente.',
                    ),
                  ),
              })
            }}
          />
        ) : (
          <BatchAdjustmentForm
            productId={id}
            submitting={adjustBatch.isPending}
            rootError={formError}
            onCancel={closeModal}
            onSubmit={(payload) => {
              adjustBatch.mutate(payload, {
                onSuccess: closeModal,
                onError: (error) =>
                  setFormError(
                    extractErrorDetail(
                      error,
                      'No se pudo ajustar el stock. Intenta nuevamente.',
                    ),
                  ),
              })
            }}
          />
        )}
      </Modal>
    </>
  )
}
