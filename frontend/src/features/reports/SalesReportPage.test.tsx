import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SalesReportPage } from './SalesReportPage'
import { nextIsoDate, todayIsoDate } from './dateRange'
import { formatCurrency, formatPercent } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'

const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const EMPTY_SUMMARY = {
  sales_count: 0,
  total_amount: '0',
  total_cost: '0',
  total_profit: '0',
  profit_margin: null,
}

const SAMPLE_SUMMARY = {
  sales_count: 10,
  total_amount: '1500.00',
  total_cost: '600.00',
  total_profit: '900.00',
  profit_margin: '60.00',
}

const SAMPLE_TIMESERIES = [
  {
    date: todayIsoDate(),
    sales_count: 10,
    revenue: '1500.00',
    cost: '600.00',
    profit: '900.00',
  },
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
    trackedHandler('/reports/sales/summary', 'summary', () => SAMPLE_SUMMARY),
    trackedHandler(
      '/reports/sales/timeseries',
      'timeseries',
      () => SAMPLE_TIMESERIES,
    ),
    trackedHandler(
      '/reports/sales/top-products',
      'top-products',
      () => SAMPLE_TOP_PRODUCTS,
    ),
    trackedHandler(
      '/reports/sales/top-customers',
      'top-customers',
      () => SAMPLE_TOP_CUSTOMERS,
    ),
  ]
}

function emptyHandlers() {
  return [
    trackedHandler('/reports/sales/summary', 'summary', () => EMPTY_SUMMARY),
    trackedHandler('/reports/sales/timeseries', 'timeseries', () => []),
    trackedHandler('/reports/sales/top-products', 'top-products', () => []),
    trackedHandler('/reports/sales/top-customers', 'top-customers', () => []),
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SalesReportPage />
    </QueryClientProvider>,
  )
}

describe('SalesReportPage', () => {
  it('renders with real data across every block', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(currencyText('1500.00'))).toBeInTheDocument() // total_amount
    })
    expect(screen.getByText(currencyText('600.00'))).toBeInTheDocument() // total_cost
    expect(screen.getByText(currencyText('900.00'))).toBeInTheDocument() // total_profit
    expect(screen.getByText(formatPercent('60.00'))).toBeInTheDocument() // profit_margin
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows a dash for profit_margin when the backend returns null', async () => {
    server.use(
      trackedHandler('/reports/sales/summary', 'summary', () => EMPTY_SUMMARY),
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument() // sales_count
    })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows loading placeholders before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/sales/summary`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(SAMPLE_SUMMARY)
      }),
    )

    renderPage()

    expect(screen.getAllByText(/cargando/i).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText(currencyText('1500.00'))).toBeInTheDocument()
    })
  })

  it('shows empty states when a range has no data', async () => {
    server.use(...emptyHandlers())
    renderPage()

    expect(
      await screen.findByText('Sin ventas en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin ventas de productos en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin ventas a clientes en el rango seleccionado'),
    ).toBeInTheDocument()
  })

  it('shows a scoped error for a single failing section without blocking the rest', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/sales/top-products`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )

    renderPage()

    expect(
      await screen.findByText('No se pudo cargar el top de productos'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(currencyText('1500.00'))).toBeInTheDocument()
    })
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows a single unified access-denied state on a 403, not four duplicates', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/sales/summary`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )

    renderPage()

    expect(
      await screen.findByText('No tienes permiso para ver este reporte'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Ventas por día')).not.toBeInTheDocument()
    expect(screen.queryByText('Productos más vendidos')).not.toBeInTheDocument()
    expect(screen.queryAllByText(/no tienes permiso/i).length).toBe(1)
  })

  it('sends date_from/date_to as YYYY-MM-DD honoring the [from, to) contract', async () => {
    renderPage()

    await waitFor(() => expect(capturedParams.summary).toBeDefined())

    const today = todayIsoDate()
    const tomorrow = nextIsoDate(today)

    expect(capturedParams.summary.get('date_from')).toBe(today)
    expect(capturedParams.summary.get('date_to')).toBe(tomorrow)
    expect(capturedParams.timeseries.get('date_from')).toBe(today)
    expect(capturedParams.timeseries.get('date_to')).toBe(tomorrow)
  })

  it('defaults top-products to order_by=revenue and refetches on selector change', async () => {
    renderPage()

    await waitFor(() => expect(capturedParams['top-products']).toBeDefined())
    expect(capturedParams['top-products'].get('order_by')).toBe('revenue')
    expect(capturedParams['top-products'].get('limit')).toBe('10')

    const select = screen.getByLabelText('Ordenar por')
    fireEvent.change(select, { target: { value: 'quantity' } })

    await waitFor(() =>
      expect(capturedParams['top-products'].get('order_by')).toBe('quantity'),
    )
  })

  it('refetches with new params when the date range changes', async () => {
    renderPage()

    await waitFor(() => expect(requestCounts.summary).toBe(1))

    const dateFromInput = screen.getByLabelText('Desde')
    fireEvent.change(dateFromInput, { target: { value: '2026-01-01' } })

    await waitFor(() => expect(requestCounts.summary).toBe(2))
    expect(capturedParams.summary.get('date_from')).toBe('2026-01-01')
  })
})
