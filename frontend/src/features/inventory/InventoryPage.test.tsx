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
import { InventoryPage } from './InventoryPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'

const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

let valuation: unknown[] = []

function resetData() {
  valuation = [
    {
      product: { id: 'prod-1', name: 'iPhone 13', sku: 'IPH-13' },
      tracking_type: 'serial',
      quantity_on_hand: 4,
      total_value: '2000.00',
    },
    {
      product: { id: 'prod-2', name: 'Cable USB-C', sku: 'CBL-USBC' },
      tracking_type: 'batch',
      quantity_on_hand: 50,
      total_value: '250.00',
    },
  ]
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/reports/inventory/valuation`, () =>
      HttpResponse.json(valuation),
    ),
    http.get(`${BASE_URL}/inventory/units/by-imei/:imei`, ({ params }) => {
      if (params.imei === '123456789012345') {
        return HttpResponse.json({
          id: 'unit-1',
          product_id: 'prod-1',
          imei: '123456789012345',
          imei2: null,
          status: 'in_stock',
          unit_cost: '500.00',
          location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        })
      }
      return HttpResponse.json({ detail: 'Product unit not found.' }, { status: 404 })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderInventoryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/inventario']}>
        <Routes>
          <Route path="/inventario" element={<InventoryPage />} />
          <Route
            path="/inventario/:productId"
            element={<div>Product detail page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InventoryPage', () => {
  it('renders the valuation list with real data', async () => {
    renderInventoryPage()

    expect(await screen.findByText('iPhone 13')).toBeInTheDocument()
    expect(screen.getByText('Cable USB-C')).toBeInTheDocument()
    expect(screen.getByText(currencyText('2000.00'))).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/inventory/valuation`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderInventoryPage()

    expect(
      await screen.findByText('No tienes permiso para ver el inventario'),
    ).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/inventory/valuation`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderInventoryPage()

    expect(
      await screen.findByText('No se pudo cargar la valuación de inventario'),
    ).toBeInTheDocument()
  })

  it('shows an empty state when there is no stock', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/inventory/valuation`, () =>
        HttpResponse.json([]),
      ),
    )
    renderInventoryPage()

    expect(
      await screen.findByText('No hay stock registrado todavía'),
    ).toBeInTheDocument()
  })

  it('filters the list by name or SKU client-side', async () => {
    const user = userEvent.setup()
    renderInventoryPage()

    await screen.findByText('iPhone 13')
    await user.type(
      screen.getByLabelText('Buscar por nombre o SKU'),
      'cable',
    )

    expect(screen.getByText('Cable USB-C')).toBeInTheDocument()
    expect(screen.queryByText('iPhone 13')).not.toBeInTheDocument()
  })

  it('navigates to the product detail page when clicking "Ver detalle"', async () => {
    const user = userEvent.setup()
    renderInventoryPage()

    await screen.findByText('iPhone 13')
    const row = screen.getByText('iPhone 13').closest('tr')
    expect(row).not.toBeNull()
    await user.click(
      screen.getAllByRole('button', { name: 'Ver detalle' })[0],
    )

    expect(await screen.findByText('Product detail page')).toBeInTheDocument()
  })

  it('navigates to the product detail page after a successful IMEI search', async () => {
    const user = userEvent.setup()
    renderInventoryPage()

    await screen.findByText('iPhone 13')
    await user.type(
      screen.getByLabelText('Buscar por IMEI'),
      '123456789012345',
    )
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Product detail page')).toBeInTheDocument()
  })

  it('shows the real backend 404 message on an unknown IMEI, verbatim', async () => {
    const user = userEvent.setup()
    renderInventoryPage()

    await screen.findByText('iPhone 13')
    await user.type(screen.getByLabelText('Buscar por IMEI'), 'unknown-imei')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(
      await screen.findByText('Product unit not found.'),
    ).toBeInTheDocument()
  })
})
