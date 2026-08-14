import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { PurchaseDetailPage } from './PurchaseDetailPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const server = setupServer(
  http.get(`${BASE_URL}/purchases/:id`, ({ params }) => {
    if (params.id === 'missing') {
      return HttpResponse.json({ detail: 'Purchase not found.' }, { status: 404 })
    }

    return HttpResponse.json({
      id: params.id,
      supplier: { id: 'supplier-1', name: 'TechImport S.A.' },
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      status: 'confirmed',
      invoice_number: 'F-001',
      purchase_date: '2026-08-01T00:00:00Z',
      total_cost: '650.00',
      notes: 'Compra inicial de stock.',
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
        {
          id: 'line-2',
          product: { id: 'prod-2', name: 'Cable USB-C', sku: 'CBL-USBC' },
          quantity: 30,
          unit_cost: '5.00',
          subtotal: '150.00',
          imei: null,
          imei2: null,
          lot_code: 'LOTE-01',
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

function renderDetailPage(purchaseId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/compras/${purchaseId}`]}>
        <Routes>
          <Route path="/compras/:purchaseId" element={<PurchaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PurchaseDetailPage', () => {
  it('renders purchase header and all lines with real data', async () => {
    renderDetailPage('purchase-1')

    expect(
      await screen.findByText('Compra a TechImport S.A.'),
    ).toBeInTheDocument()
    expect(screen.getByText(currencyText('650.00'))).toBeInTheDocument()
    expect(screen.getByText('F-001')).toBeInTheDocument()
    expect(screen.getByText('Compra inicial de stock.')).toBeInTheDocument()
    expect(screen.getByText('iPhone 13 (IPH-13)')).toBeInTheDocument()
    expect(screen.getByText('123456789012345')).toBeInTheDocument()
    expect(screen.getByText('Cable USB-C (CBL-USBC)')).toBeInTheDocument()
    expect(screen.getByText('LOTE-01')).toBeInTheDocument()
  })

  it('shows a not-found state on a 404 from the backend', async () => {
    renderDetailPage('missing')

    expect(
      await screen.findByText('Compra no encontrada'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/purchases/:id`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderDetailPage('purchase-1')

    expect(
      await screen.findByText('No tienes permiso para ver esta compra'),
    ).toBeInTheDocument()
  })
})
