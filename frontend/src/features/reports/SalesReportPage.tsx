import { useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/feedback/EmptyState'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { StatTile } from './components/StatTile'
import { DateRangePicker } from './components/DateRangePicker'
import { SalesTimeseriesChart } from './components/SalesTimeseriesChart'
import { TopList } from './components/TopList'
import type { TopListItem } from './components/TopList'
import {
  useSalesSummary,
  useSalesTimeseries,
  useSalesTopCustomers,
  useSalesTopProducts,
} from './hooks/useReports'
import { isForbidden } from './errors'
import { todayIsoDate } from './dateRange'
import { formatCurrency, formatPercent } from './format'
import type { DateRange, SalesTopProductsOrderBy } from './types/reports'

export function SalesReportPage() {
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayIsoDate()
    return { dateFrom: today, dateTo: today }
  })
  const [orderBy, setOrderBy] = useState<SalesTopProductsOrderBy>('revenue')

  const summaryQuery = useSalesSummary(range)
  const timeseriesQuery = useSalesTimeseries(range)
  const topProductsQuery = useSalesTopProducts(range, orderBy)
  const topCustomersQuery = useSalesTopCustomers(range)

  // Same reasoning as DashboardPage (F4): the frontend has no
  // client-side knowledge of the current user's permissions, so a 403
  // from any of the reports.read-gated endpoints is treated as "this
  // whole report is off-limits", not a per-block error.
  const forbidden = [
    summaryQuery,
    timeseriesQuery,
    topProductsQuery,
    topCustomersQuery,
  ].some((query) => isForbidden(query.error))

  const topProductItems: TopListItem[] = useMemo(
    () =>
      (topProductsQuery.data ?? []).map((entry) => ({
        id: entry.product.id,
        primary: entry.product.name,
        secondary: `${entry.quantity_sold} unidades`,
        amount: formatCurrency(entry.revenue),
      })),
    [topProductsQuery.data],
  )

  const topCustomerItems: TopListItem[] = useMemo(
    () =>
      (topCustomersQuery.data ?? []).map((entry) => ({
        id: entry.customer.id,
        primary: entry.customer.name,
        secondary: `${entry.sales_count} ventas`,
        amount: formatCurrency(entry.revenue),
      })),
    [topCustomersQuery.data],
  )

  if (forbidden) {
    return (
      <>
        <PageHeader title="Reportes de ventas" />
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
        title="Reportes de ventas"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Ventas"
          value={summary ? String(summary.sales_count) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Monto total"
          value={summary ? formatCurrency(summary.total_amount) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Costo total"
          value={summary ? formatCurrency(summary.total_cost) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Utilidad"
          value={summary ? formatCurrency(summary.total_profit) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Margen"
          value={
            summary
              ? summary.profit_margin !== null
                ? formatPercent(summary.profit_margin)
                : '—'
              : ''
          }
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Ventas por día</h2>
        <div className="mt-3">
          {timeseriesQuery.isPending ? (
            <div className="flex h-[260px] items-center justify-center">
              <Spinner label="Cargando ventas por día" />
            </div>
          ) : timeseriesQuery.isError ? (
            <EmptyState title="No se pudo cargar el gráfico de ventas" />
          ) : (timeseriesQuery.data ?? []).length === 0 ? (
            <EmptyState title="Sin ventas en el rango seleccionado" />
          ) : (
            <SalesTimeseriesChart data={timeseriesQuery.data ?? []} />
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Productos más vendidos
            </h2>
            <label className="sr-only" htmlFor="sales-top-products-order-by">
              Ordenar por
            </label>
            <Select
              id="sales-top-products-order-by"
              className="w-40"
              value={orderBy}
              onChange={(event) =>
                setOrderBy(event.target.value as SalesTopProductsOrderBy)
              }
            >
              <option value="revenue">Por ingresos</option>
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
                emptyMessage="Sin ventas de productos en el rango seleccionado"
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Mejores clientes</h2>
          <div className="mt-3">
            {topCustomersQuery.isPending ? (
              <Spinner label="Cargando clientes" />
            ) : topCustomersQuery.isError ? (
              <EmptyState title="No se pudo cargar el top de clientes" />
            ) : (
              <TopList
                items={topCustomerItems}
                emptyMessage="Sin ventas a clientes en el rango seleccionado"
              />
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
