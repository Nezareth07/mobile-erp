import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SaleDetailPage } from './SaleDetailPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const server = setupServer(
  http.get(`${BASE_URL}/sales/:id`, ({ params }) => {
    if (params.id === 'missing') {
      return HttpResponse.json({ detail: 'Sale not found.' }, { status: 404 })
    }

    return HttpResponse.json({
      id: params.id,
      customer: { id: 'customer-1', name: 'Juan Pérez' },
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      status: 'confirmed',
      sale_date: '2026-08-01T00:00:00Z',
      total_amount: '650.00',
      total_cost: '450.00',
      profit: '200.00',
      notes: 'Venta de contado.',
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
        {
          id: 'line-2',
          product: { id: 'prod-2', name: 'Cable USB-C', sku: 'CBL-USBC' },
          quantity: 15,
          unit_price: '10.00',
          unit_cost: '6.67',
          subtotal: '150.00',
          imei: null,
        },
      ],
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderDetailPage(saleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/ventas/${saleId}`]}>
        <Routes>
          <Route path="/ventas/:saleId" element={<SaleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SaleDetailPage', () => {
  it('renders sale header and all lines with real data', async () => {
    renderDetailPage('sale-1')

    expect(
      await screen.findByText('Venta a Juan Pérez'),
    ).toBeInTheDocument()
    expect(screen.getByText(currencyText('650.00'))).toBeInTheDocument()
    expect(screen.getByText(currencyText('200.00'))).toBeInTheDocument()
    expect(screen.getByText('Venta de contado.')).toBeInTheDocument()
    expect(screen.getByText('iPhone 13 (IPH-13)')).toBeInTheDocument()
    expect(screen.getByText('123456789012345')).toBeInTheDocument()
    expect(screen.getByText('Cable USB-C (CBL-USBC)')).toBeInTheDocument()
  })

  it('shows a not-found state on a 404 from the backend', async () => {
    renderDetailPage('missing')

    expect(await screen.findByText('Venta no encontrada')).toBeInTheDocument()
  })

  it('shows a 403 empty state without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/sales/:id`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderDetailPage('sale-1')

    expect(
      await screen.findByText('No tienes permiso para ver esta venta'),
    ).toBeInTheDocument()
  })
})
