import { useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/feedback/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { StatTile } from './components/StatTile'
import { DateRangePicker } from './components/DateRangePicker'
import { SalesOverviewChart } from './components/SalesOverviewChart'
import { TopList } from './components/TopList'
import type { TopListItem } from './components/TopList'
import { RecentActivityList } from './components/RecentActivityList'
import {
  useDashboardSummary,
  useRecentActivity,
  useSalesOverview,
  useTopCustomers,
  useTopProducts,
} from './hooks/useDashboardData'
import { todayIsoDate } from './dateRange'
import { formatCurrency } from './format'
import type { DateRange } from './types/dashboard'

// The frontend has no client-side knowledge of the current user's
// permissions (the JWT carries no roles/permissions and /users/{id} is
// ADMIN-only -- see F4 design discussion). Authorization stays reactive:
// a 403 from any of the 5 dashboard.read-gated endpoints is treated as
// "the whole Dashboard is off-limits", not a per-block error.
function isForbidden(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403
}

export function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayIsoDate()
    return { dateFrom: today, dateTo: today }
  })

  const summaryQuery = useDashboardSummary(range)
  const salesOverviewQuery = useSalesOverview(range)
  const topProductsQuery = useTopProducts(range)
  const topCustomersQuery = useTopCustomers(range)
  const recentActivityQuery = useRecentActivity()

  const forbidden = [
    summaryQuery,
    salesOverviewQuery,
    topProductsQuery,
    topCustomersQuery,
    recentActivityQuery,
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
        <PageHeader title="Dashboard" />
        <div className="mt-6">
          <EmptyState
            title="No tienes permiso para ver este Dashboard"
            description="Tu usuario no cuenta con el permiso dashboard.read. Contacta a un administrador si crees que esto es un error."
          />
        </div>
      </>
    )
  }

  const summary = summaryQuery.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Ventas de hoy"
          value={summary ? formatCurrency(summary.sales_today.total_amount) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Ventas del período"
          value={summary ? formatCurrency(summary.sales_period.total_amount) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Compras del período"
          value={
            summary ? formatCurrency(summary.purchases_period.total_cost) : ''
          }
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Clientes activos"
          value={summary ? String(summary.active_customers_count) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Productos activos"
          value={summary ? String(summary.active_products_count) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
        <StatTile
          label="Proveedores activos"
          value={summary ? String(summary.active_suppliers_count) : ''}
          loading={summaryQuery.isPending}
          error={summaryQuery.isError}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Ventas por día</h2>
        <div className="mt-3">
          {salesOverviewQuery.isPending ? (
            <div className="flex h-[260px] items-center justify-center">
              <Spinner label="Cargando ventas por día" />
            </div>
          ) : salesOverviewQuery.isError ? (
            <EmptyState title="No se pudo cargar el gráfico de ventas" />
          ) : (salesOverviewQuery.data ?? []).length === 0 ? (
            <EmptyState title="Sin ventas en el rango seleccionado" />
          ) : (
            <SalesOverviewChart data={salesOverviewQuery.data ?? []} />
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">
            Productos más vendidos
          </h2>
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

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Actividad reciente</h2>
        <div className="mt-3">
          {recentActivityQuery.isPending ? (
            <Spinner label="Cargando actividad reciente" />
          ) : recentActivityQuery.isError ? (
            <EmptyState title="No se pudo cargar la actividad reciente" />
          ) : (
            <RecentActivityList items={recentActivityQuery.data ?? []} />
          )}
        </div>
      </Card>
    </>
  )
}
