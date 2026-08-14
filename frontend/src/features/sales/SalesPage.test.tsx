import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SalesPage } from './SalesPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

function sale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    customer: { id: 'customer-1', name: 'Juan Pérez' },
    location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
    status: 'confirmed',
    sale_date: '2026-08-01T00:00:00Z',
    total_amount: '500.00',
    total_cost: '350.00',
    profit: '150.00',
    notes: null,
    lines: [
      {
        id: 'line-1',
        product: { id: 'prod-1', name: 'iPhone 13', sku: 'IPH-13' },
        quantity: 1,
        unit_price: '500.00',
        unit_cost: '350.00',
        subtotal: '500.00',
        imei: '123456789012345',
      },
    ],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

let sales: unknown[] = []
let lastSalesUrl: URL | null = null

function resetData() {
  sales = [sale()]
  lastSalesUrl = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/sales`, ({ request }) => {
      lastSalesUrl = new URL(request.url)
      return HttpResponse.json(sales)
    }),
    http.get(`${BASE_URL}/customers`, () =>
      HttpResponse.json([{ id: 'customer-1', name: 'Juan Pérez' }]),
    ),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderSalesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ventas']}>
        <Routes>
          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/ventas/nueva" element={<div>New sale page</div>} />
          <Route path="/ventas/:saleId" element={<div>Sale detail page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SalesPage', () => {
  it('renders the list with real data', async () => {
    renderSalesPage()

    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText(currencyText('500.00'))).toBeInTheDocument()
    expect(screen.getByText(currencyText('150.00'))).toBeInTheDocument()
    expect(screen.getAllByText('Juan Pérez')).toHaveLength(2)
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/sales`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(sales)
      }),
    )

    const { container } = renderSalesPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/sales`, () => HttpResponse.json([])))
    renderSalesPage()

    expect(
      await screen.findByText('No hay ventas todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Registrar la primera')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/sales`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderSalesPage()

    expect(
      await screen.findByText('No se pudieron cargar las ventas'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/sales`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderSalesPage()

    expect(
      await screen.findByText('No tienes permiso para ver ventas'),
    ).toBeInTheDocument()
  })

  it('filters by customer_id and resets pagination', async () => {
    const user = userEvent.setup()
    renderSalesPage()

    await screen.findByText('Confirmada')
    await user.selectOptions(screen.getByLabelText('Cliente'), 'Juan Pérez')

    expect(lastSalesUrl).not.toBeNull()
    expect(lastSalesUrl!.searchParams.get('customer_id')).toBe('customer-1')
    expect(lastSalesUrl!.searchParams.get('offset')).toBe('0')
    expect(lastSalesUrl!.searchParams.get('limit')).toBe('20')
  })

  it('disables "Anterior" on the first page and "Siguiente" when a page is not full', async () => {
    renderSalesPage()

    expect(
      await screen.findByRole('button', { name: 'Anterior' }),
    ).toBeDisabled()
    expect(
      await screen.findByRole('button', { name: 'Siguiente' }),
    ).toBeDisabled()
  })

  it('navigates to the detail page when clicking "Ver detalle"', async () => {
    const user = userEvent.setup()
    renderSalesPage()

    await screen.findByText('Confirmada')
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }))

    expect(await screen.findByText('Sale detail page')).toBeInTheDocument()
  })

  it('navigates to the creation page when clicking "Nueva venta"', async () => {
    const user = userEvent.setup()
    renderSalesPage()

    await screen.findByText('Confirmada')
    await user.click(screen.getByRole('button', { name: 'Nueva venta' }))

    expect(await screen.findByText('New sale page')).toBeInTheDocument()
  })
})
