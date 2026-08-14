import { useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/feedback/EmptyState'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { StatTile } from './components/StatTile'
import { DateRangePicker } from './components/DateRangePicker'
import { PurchasesTimeseriesChart } from './components/PurchasesTimeseriesChart'
import { TopList } from './components/TopList'
import type { TopListItem } from './components/TopList'
import {
  usePurchasesSummary,
  usePurchasesTimeseries,
  usePurchasesTopProducts,
  usePurchasesTopSuppliers,
} from './hooks/useReports'
import { isForbidden } from './errors'
import { todayIsoDate } from './dateRange'
import { formatCurrency } from './format'
import type { DateRange, PurchasesTopProductsOrderBy } from './types/reports'

export function PurchasesReportPage() {
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayIsoDate()
    return { dateFrom: today, dateTo: today }
  })
  const [orderBy, setOrderBy] = useState<PurchasesTopProductsOrderBy>('cost')

  const summaryQuery = usePurchasesSummary(range)
  const timeseriesQuery = usePurchasesTimeseries(range)
  const topSuppliersQuery = usePurchasesTopSuppliers(range)
  const topProductsQuery = usePurchasesTopProducts(range, orderBy)

  // Same reasoning as SalesReportPage/DashboardPage (F4): a 403 from any
  // of the reports.read-gated endpoints is treated as "this whole report
  // is off-limits", not a per-block error.
  const forbidden = [
    summaryQuery,
    timeseriesQuery,
    topSuppliersQuery,
    topProductsQuery,
  ].some((query) => isForbidden(query.error))

  const topSupplierItems: TopListItem[] = useMemo(
    () =>
      (topSuppliersQuery.data ?? []).map((entry) => ({
        id: entry.supplier.id,
        primary: entry.supplier.name,
        secondary: `${entry.purchases_count} compras`,
        amount: formatCurrency(entry.total_cost),
      })),
    [topSuppliersQuery.data],
  )

  const topProductItems: TopListItem[] = useMemo(
    () =>
      (topProductsQuery.data ?? []).map((entry) => ({
        id: entry.product.id,
        primary: entry.product.name,
        secondary: `${entry.quantity_purchased} unidades`,
        amount: formatCurrency(entry.total_cost),
      })),
    [topProductsQuery.data],
  )

  if (forbidden) {
    return (
      <>
        <PageHeader title="Reportes de compras" />
        <div className="mt-6">
          <EmptyState
            title="No tienes permiso para ver este reporte"
            description="Tu usuario no cuenta con el permiso reports.read. Contacta a un administrador si crees que esto es un error."
          />
        </div>
      </>
    )
  }

  const summary = summaryQuery.data

  return (
    <>
      <PageHeader
        title="Reportes de compras"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="mt-6 grid grid-cols-2 gap-4">
        <StatTile
          label="Compras"
          value={summary ? String(summary.purchases_count) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Costo total"
          value={summary ? formatCurrency(summary.total_cost) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Compras por día</h2>
        <div className="mt-3">
          {timeseriesQuery.isPending ? (
            <div className="flex h-[260px] items-center justify-center">
              <Spinner label="Cargando compras por día" />
            </div>
          ) : timeseriesQuery.isError ? (
            <EmptyState title="No se pudo cargar el gráfico de compras" />
          ) : (timeseriesQuery.data ?? []).length === 0 ? (
            <EmptyState title="Sin compras en el rango seleccionado" />
          ) : (
            <PurchasesTimeseriesChart data={timeseriesQuery.data ?? []} />
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">
            Principales proveedores
          </h2>
          <div className="mt-3">
            {topSuppliersQuery.isPending ? (
              <Spinner label="Cargando proveedores" />
            ) : topSuppliersQuery.isError ? (
              <EmptyState title="No se pudo cargar el top de proveedores" />
            ) : (
              <TopList
                items={topSupplierItems}
                emptyMessage="Sin compras a proveedores en el rango seleccionado"
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Productos más comprados
            </h2>
            <label
              className="sr-only"
              htmlFor="purchases-top-products-order-by"
            >
              Ordenar por
            </label>
            <Select
              id="purchases-top-products-order-by"
              className="w-40"
              value={orderBy}
              onChange={(event) =>
                setOrderBy(event.target.value as PurchasesTopProductsOrderBy)
              }
            >
              <option value="cost">Por costo</option>
              <option value="quantity">Por cantidad</option>
            </Select>
          </div>
          <div className="mt-3">
            {topProductsQuery.isPending ? (
              <Spinner label="Cargando productos" />
            ) : topProductsQuery.isError ? (
              <EmptyState title="No se pudo cargar el top de productos" />
            ) : (
              <TopList
                items={topProductItems}
                emptyMessage="Sin compras de productos en el rango seleccionado"
              />
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
