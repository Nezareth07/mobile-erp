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
import { PurchasesPage } from './PurchasesPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

function purchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'purchase-1',
    supplier: { id: 'supplier-1', name: 'TechImport S.A.' },
    location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
    status: 'confirmed',
    invoice_number: 'F-001',
    purchase_date: '2026-08-01T00:00:00Z',
    total_cost: '500.00',
    notes: null,
    lines: [
      {
        id: 'line-1',
        product: { id: 'prod-1', name: 'iPhone 13', sku: 'IPH-13' },
        quantity: 1,
        unit_cost: '500.00',
        subtotal: '500.00',
        imei: '123456789012345',
        imei2: null,
        lot_code: null,
      },
    ],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

let purchases: unknown[] = []
let lastPurchasesUrl: URL | null = null

function resetData() {
  purchases = [purchase()]
  lastPurchasesUrl = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/purchases`, ({ request }) => {
      lastPurchasesUrl = new URL(request.url)
      return HttpResponse.json(purchases)
    }),
    http.get(`${BASE_URL}/suppliers`, () =>
      HttpResponse.json([{ id: 'supplier-1', name: 'TechImport S.A.' }]),
    ),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPurchasesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/compras']}>
        <Routes>
          <Route path="/compras" element={<PurchasesPage />} />
          <Route path="/compras/nueva" element={<div>New purchase page</div>} />
          <Route
            path="/compras/:purchaseId"
            element={<div>Purchase detail page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PurchasesPage', () => {
  it('renders the list with real data', async () => {
    renderPurchasesPage()

    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText(currencyText('500.00'))).toBeInTheDocument()
    // 'TechImport S.A.' appears twice once loaded (the supplier filter
    // <option> and the table cell) -- assert there are exactly the two
    // expected occurrences rather than an ambiguous single-match query.
    expect(screen.getAllByText('TechImport S.A.')).toHaveLength(2)
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/purchases`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(purchases)
      }),
    )

    const { container } = renderPurchasesPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Confirmada')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/purchases`, () => HttpResponse.json([])))
    renderPurchasesPage()

    expect(
      await screen.findByText('No hay compras todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Registrar la primera')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/purchases`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderPurchasesPage()

    expect(
      await screen.findByText('No se pudieron cargar las compras'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/purchases`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderPurchasesPage()

    expect(
      await screen.findByText('No tienes permiso para ver compras'),
    ).toBeInTheDocument()
  })

  it('filters by supplier_id and resets pagination', async () => {
    const user = userEvent.setup()
    renderPurchasesPage()

    await screen.findByText('Confirmada')
    await user.selectOptions(
      screen.getByLabelText('Proveedor'),
      'TechImport S.A.',
    )

    expect(lastPurchasesUrl).not.toBeNull()
    expect(lastPurchasesUrl!.searchParams.get('supplier_id')).toBe(
      'supplier-1',
    )
    expect(lastPurchasesUrl!.searchParams.get('offset')).toBe('0')
    expect(lastPurchasesUrl!.searchParams.get('limit')).toBe('20')
  })

  it('disables "Anterior" on the first page and "Siguiente" when a page is not full', async () => {
    renderPurchasesPage()

    expect(
      await screen.findByRole('button', { name: 'Anterior' }),
    ).toBeDisabled()
    expect(
      await screen.findByRole('button', { name: 'Siguiente' }),
    ).toBeDisabled()
  })

  it('navigates to the detail page when clicking "Ver detalle"', async () => {
    const user = userEvent.setup()
    renderPurchasesPage()

    await screen.findByText('Confirmada')
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }))

    expect(await screen.findByText('Purchase detail page')).toBeInTheDocument()
  })

  it('navigates to the creation page when clicking "Nueva compra"', async () => {
    const user = userEvent.setup()
    renderPurchasesPage()

    await screen.findByText('Confirmada')
    await user.click(screen.getByRole('button', { name: 'Nueva compra' }))

    expect(await screen.findByText('New purchase page')).toBeInTheDocument()
  })
})
