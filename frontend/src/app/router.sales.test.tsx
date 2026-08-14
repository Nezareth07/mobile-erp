import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

// App.tsx (F3, closed phase) uses a module-level QueryClient with
// TanStack Query's default retry behavior (3 attempts with backoff), so
// an error response takes several seconds to settle -- far past a normal
// assertion timeout. The 404/403 branches of SaleDetailPage are already
// covered in isolation in SaleDetailPage.test.tsx (with retry disabled
// there); this file only needs a success response to prove the route
// wires to the right component. Same lesson already applied in
// router.purchases.test.tsx (F9).
const server = setupServer(
  http.get(`${BASE_URL}/sales`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/customers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/products`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/sales/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      customer: { id: 'customer-1', name: 'Juan Pérez' },
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      status: 'confirmed',
      sale_date: '2026-08-01T00:00:00Z',
      total_amount: '0.00',
      total_cost: '0.00',
      profit: '0.00',
      notes: null,
      lines: [],
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearTokens()
})
afterAll(() => server.close())

function renderAt(path: string) {
  setTokens('access-token', 'refresh-token')
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('AppRouter -- /ventas', () => {
  it('renders SalesPage at /ventas', async () => {
    renderAt('/ventas')

    expect(
      await screen.findByText('No hay ventas todavía'),
    ).toBeInTheDocument()
  })

  it('renders NewSalePage at /ventas/nueva', async () => {
    renderAt('/ventas/nueva')

    expect(await screen.findByText('Nueva venta')).toBeInTheDocument()
  })

  it('renders SaleDetailPage at /ventas/:id', async () => {
    renderAt('/ventas/some-sale-id')

    expect(
      await screen.findByText('Venta a Juan Pérez'),
    ).toBeInTheDocument()
  })

  it('exposes Ventas as a real Sidebar link, distinct from the placeholder buttons', async () => {
    renderAt('/ventas')

    await screen.findByText('No hay ventas todavía')
    const salesLink = screen.getByRole('link', { name: 'Ventas' })
    expect(salesLink).toHaveAttribute('href', '/ventas')

    expect(
      screen.queryByRole('link', { name: 'Reportes' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument()
  })

  it('marks the Ventas link as active when on /ventas', async () => {
    renderAt('/ventas')

    await screen.findByText('No hay ventas todavía')
    const salesLink = screen.getByRole('link', { name: 'Ventas' })

    await waitFor(() => expect(salesLink).toHaveClass('border-primary'))
  })
})
