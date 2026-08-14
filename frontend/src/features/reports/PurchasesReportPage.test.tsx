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
import { PurchasesReportPage } from './PurchasesReportPage'
import { nextIsoDate, todayIsoDate } from './dateRange'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'

const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const EMPTY_SUMMARY = { purchases_count: 0, total_cost: '0' }

const SAMPLE_SUMMARY = { purchases_count: 6, total_cost: '2400.00' }

const SAMPLE_TIMESERIES = [
  { date: todayIsoDate(), purchases_count: 6, total_cost: '2400.00' },
]

const SAMPLE_TOP_SUPPLIERS = [
  {
    supplier: { id: 'sup-1', name: 'TechImport S.A.' },
    purchases_count: 4,
    total_cost: '1800.00',
  },
]

const SAMPLE_TOP_PRODUCTS = [
  {
    product: { id: 'prod-1', name: 'iPhone 15', sku: 'PHN-IPH15-128BLK' },
    quantity_purchased: 12,
    total_cost: '3600.00',
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
    trackedHandler(
      '/reports/purchases/summary',
      'summary',
      () => SAMPLE_SUMMARY,
    ),
    trackedHandler(
      '/reports/purchases/timeseries',
      'timeseries',
      () => SAMPLE_TIMESERIES,
    ),
    trackedHandler(
      '/reports/purchases/top-suppliers',
      'top-suppliers',
      () => SAMPLE_TOP_SUPPLIERS,
    ),
    trackedHandler(
      '/reports/purchases/top-products',
      'top-products',
      () => SAMPLE_TOP_PRODUCTS,
    ),
  ]
}

function emptyHandlers() {
  return [
    trackedHandler('/reports/purchases/summary', 'summary', () => EMPTY_SUMMARY),
    trackedHandler('/reports/purchases/timeseries', 'timeseries', () => []),
    trackedHandler(
      '/reports/purchases/top-suppliers',
      'top-suppliers',
      () => [],
    ),
    trackedHandler('/reports/purchases/top-products', 'top-products', () => []),
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
      <PurchasesReportPage />
    </QueryClientProvider>,
  )
}

describe('PurchasesReportPage', () => {
  it('renders with real data across every block', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument() // purchases_count
    })
    expect(screen.getByText(currencyText('2400.00'))).toBeInTheDocument() // total_cost
    expect(screen.getByText('TechImport S.A.')).toBeInTheDocument()
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
  })

  it('shows loading placeholders before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/purchases/summary`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(SAMPLE_SUMMARY)
      }),
    )

    renderPage()

    expect(screen.getAllByText(/cargando/i).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText(currencyText('2400.00'))).toBeInTheDocument()
    })
  })

  it('shows empty states when a range has no data', async () => {
    server.use(...emptyHandlers())
    renderPage()

    expect(
      await screen.findByText('Sin compras en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin compras a proveedores en el rango seleccionado'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin compras de productos en el rango seleccionado'),
    ).toBeInTheDocument()
  })

  it('shows a scoped error for a single failing section without blocking the rest', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/purchases/top-suppliers`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )

    renderPage()

    expect(
      await screen.findByText('No se pudo cargar el top de proveedores'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(currencyText('2400.00'))).toBeInTheDocument()
    })
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
  })

  it('shows a single unified access-denied state on a 403, not four duplicates', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/purchases/summary`, () =>
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
    expect(screen.queryByText('Compras por día')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Principales proveedores'),
    ).not.toBeInTheDocument()
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

  it('defaults top-products to order_by=cost and refetches on selector change', async () => {
    renderPage()

    await waitFor(() => expect(capturedParams['top-products']).toBeDefined())
    expect(capturedParams['top-products'].get('order_by')).toBe('cost')
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
