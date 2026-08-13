import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { DashboardPage } from './DashboardPage'
import { nextIsoDate, todayIsoDate } from './dateRange'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'

// Intl.NumberFormat inserts a non-breaking space (U+00A0) between "USD"
// and the amount. Testing Library's default text normalizer collapses
// that to a regular space when reading the DOM, but does not touch the
// raw string passed in as a matcher -- so the matcher needs the same
// normalization applied to compare like with like.
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const EMPTY_SUMMARY = {
  sales_today: {
    sales_count: 0,
    total_amount: '0',
    total_cost: '0',
    total_profit: '0',
  },
  sales_period: {
    sales_count: 0,
    total_amount: '0',
    total_cost: '0',
    total_profit: '0',
  },
  purchases_period: { purchases_count: 0, total_cost: '0' },
  period_date_from: todayIsoDate(),
  period_date_to: todayIsoDate(),
  active_customers_count: 0,
  active_products_count: 0,
  active_suppliers_count: 0,
}

const SAMPLE_SUMMARY = {
  ...EMPTY_SUMMARY,
  sales_today: {
    sales_count: 3,
    total_amount: '450.00',
    total_cost: '200.00',
    total_profit: '250.00',
  },
  sales_period: {
    sales_count: 10,
    total_amount: '1500.00',
    total_cost: '700.00',
    total_profit: '800.00',
  },
  purchases_period: { purchases_count: 4, total_cost: '900.00' },
  active_customers_count: 12,
  active_products_count: 34,
  active_suppliers_count: 5,
}

const SAMPLE_SALES_OVERVIEW = [
  { date: todayIsoDate(), sales_count: 3, revenue: '450.00', cost: '200.00', profit: '250.00' },
]

const SAMPLE_TOP_PRODUCTS = [
  {
    product: { id: 'prod-1', name: 'iPhone 15', sku: 'PHN-IPH15-128BLK' },
    quantity_sold: 8,
    revenue: '4800.00',
  },
]

const SAMPLE_TOP_CUSTOMERS = [
  {
    customer: { id: 'cust-1', name: 'Juan Pérez' },
    sales_count: 5,
    revenue: '620.00',
  },
]

const SAMPLE_RECENT_ACTIVITY = [
  {
    id: 'mov-1',
    product: { id: 'prod-1', name: 'iPhone 15', sku: 'PHN-IPH15-128BLK' },
    movement_type: 'sale_out',
    quantity: 1,
    unit_cost: '600.00',
    location: { id: 'loc-1', name: 'Sucursal Centro', type: 'store' },
    source_type: 'sale',
    source_reference: 'SALE-1',
    notes: null,
    created_at: '2026-08-13T15:30:00Z',
  },
  {
    id: 'mov-2',
    product: { id: 'prod-2', name: 'Cargador USB-C', sku: 'ACC-CHG-USBC' },
    movement_type: 'purchase_in',
    quantity: 20,
    unit_cost: '5.00',
    location: { id: 'loc-1', name: 'Sucursal Centro', type: 'store' },
    source_type: 'purchase',
    source_reference: 'PUR-1',
    notes: null,
    created_at: '2026-08-13T09:00:00Z',
  },
]

let capturedParams: Record<string, URLSearchParams> = {}
let requestCounts: Record<string, number> = {}

function trackedHandler(
  path: string,
  key: string,
  resolve: () => Record<string, unknown> | unknown[],
) {
  return http.get(`${BASE_URL}${path}`, ({ request }) => {
    const url = new URL(request.url)
    capturedParams[key] = url.searchParams
    requestCounts[key] = (requestCounts[key] ?? 0) + 1
    return HttpResponse.json(resolve())
  })
}

function successHandlers() {
  return [
    trackedHandler('/dashboard/summary', 'summary', () => SAMPLE_SUMMARY),
    trackedHandler(
      '/dashboard/sales-overview',
      'sales-overview',
      () => SAMPLE_SALES_OVERVIEW,
    ),
    trackedHandler(
      '/dashboard/top-products',
      'top-products',
      () => SAMPLE_TOP_PRODUCTS,
    ),
    trackedHandler(
      '/dashboard/top-customers',
      'top-customers',
      () => SAMPLE_TOP_CUSTOMERS,
    ),
    trackedHandler(
      '/dashboard/recent-activity',
      'recent-activity',
      () => SAMPLE_RECENT_ACTIVITY,
    ),
  ]
}

function emptyHandlers() {
  return [
    trackedHandler('/dashboard/summary', 'summary', () => EMPTY_SUMMARY),
    trackedHandler('/dashboard/sales-overview', 'sales-overview', () => []),
    trackedHandler('/dashboard/top-products', 'top-products', () => []),
    trackedHandler('/dashboard/top-customers', 'top-customers', () => []),
    trackedHandler('/dashboard/recent-activity', 'recent-activity', () => []),
  ]
}

const server = setupServer(...successHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  capturedParams = {}
  requestCounts = {}
})
afterAll(() => server.close())

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  it('renders with real data across every block', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(
        screen.getByText(currencyText('450.00')),
      ).toBeInTheDocument() // sales_today
    })
    expect(screen.getByText(currencyText('1500.00'))).toBeInTheDocument() // sales_period
    expect(screen.getByText(currencyText('900.00'))).toBeInTheDocument() // purchases_period
    expect(screen.getByText('12')).toBeInTheDocument() // active customers
    expect(screen.getByText('34')).toBeInTheDocument() // active products
    expect(screen.getByText('5')).toBeInTheDocument() // active suppliers

    // "iPhone 15" appears both in Top Products and Recent Activity.
    const iPhoneMentions = await screen.findAllByText('iPhone 15')
    expect(iPhoneMentions.length).toBe(2)
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Cargador USB-C')).toBeInTheDocument()
  })

  it('shows loading placeholders before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/dashboard/summary`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(SAMPLE_SUMMARY)
      }),
    )

    renderDashboard()

    expect(screen.getAllByText(/cargando/i).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText(currencyText('450.00'))).toBeInTheDocument()
    })
  })

  it('shows empty states when a range has no data', async () => {
    server.use(...emptyHandlers())
    renderDashboard()

    expect(
      await screen.findByText('Sin ventas en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin ventas de productos en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin ventas a clientes en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin movimientos recientes')).toBeInTheDocument()
  })

  it('shows a scoped error for a single failing section without blocking the rest', async () => {
    server.use(
      http.get(`${BASE_URL}/dashboard/top-products`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )

    renderDashboard()

    expect(
      await screen.findByText('No se pudo cargar el top de productos'),
    ).toBeInTheDocument()
    // The rest of the dashboard still renders normally.
    await waitFor(() => {
      expect(screen.getByText(currencyText('450.00'))).toBeInTheDocument()
    })
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows a single unified access-denied state on a 403, not five duplicates', async () => {
    server.use(
      http.get(`${BASE_URL}/dashboard/summary`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )

    renderDashboard()

    expect(
      await screen.findByText('No tienes permiso para ver este Dashboard'),
    ).toBeInTheDocument()

    // None of the normal dashboard content should render.
    expect(screen.queryByText('Ventas por día')).not.toBeInTheDocument()
    expect(screen.queryByText('Productos más vendidos')).not.toBeInTheDocument()
    expect(
      screen.queryAllByText(/no tienes permiso/i).length,
    ).toBe(1)
  })

  it('sends date_from/date_to as YYYY-MM-DD honoring the [from, to) contract', async () => {
    renderDashboard()

    await waitFor(() => expect(capturedParams.summary).toBeDefined())

    const today = todayIsoDate()
    const tomorrow = nextIsoDate(today)

    expect(capturedParams.summary.get('date_from')).toBe(today)
    expect(capturedParams.summary.get('date_to')).toBe(tomorrow)
    expect(capturedParams['sales-overview'].get('date_from')).toBe(today)
    expect(capturedParams['sales-overview'].get('date_to')).toBe(tomorrow)
  })

  it('sends order_by=revenue on top-products and never exposes a selector', async () => {
    renderDashboard()

    await waitFor(() => expect(capturedParams['top-products']).toBeDefined())
    expect(capturedParams['top-products'].get('order_by')).toBe('revenue')
    expect(screen.queryByText(/quantity/i)).not.toBeInTheDocument()
  })

  it('refetches with new params when the date range changes', async () => {
    renderDashboard()

    await waitFor(() => expect(requestCounts.summary).toBe(1))

    const dateFromInput = screen.getByLabelText('Desde')
    fireEvent.change(dateFromInput, { target: { value: '2026-01-01' } })

    await waitFor(() => expect(requestCounts.summary).toBe(2))
    expect(capturedParams.summary.get('date_from')).toBe('2026-01-01')
  })

  it('renders recent activity with movement type and location', async () => {
    renderDashboard()

    const list = await screen.findByText('Cargador USB-C')
    const item = list.closest('li')
    expect(item).not.toBeNull()
    expect(within(item as HTMLElement).getByText('Compra')).toBeInTheDocument()
    expect(
      within(item as HTMLElement).getByText(/Sucursal Centro/),
    ).toBeInTheDocument()

    expect(screen.getByText('Venta')).toBeInTheDocument()
  })

  it('lays out the KPI row with the responsive grid classes used elsewhere in the app', async () => {
    const { container } = renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(currencyText('450.00'))).toBeInTheDocument()
    })

    const kpiGrid = container.querySelector('.grid.grid-cols-2')
    expect(kpiGrid).not.toBeNull()
    expect(kpiGrid).toHaveClass('sm:grid-cols-3', 'lg:grid-cols-6')
  })
})
