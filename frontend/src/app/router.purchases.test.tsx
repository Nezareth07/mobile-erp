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
// assertion timeout. The 404/403 branches of PurchaseDetailPage are
// already covered in isolation in PurchaseDetailPage.test.tsx (with
// retry disabled there); this file only needs a success response to
// prove the route wires to the right component.
const server = setupServer(
  http.get(`${BASE_URL}/purchases`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/suppliers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/products`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/purchases/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      supplier: { id: 'supplier-1', name: 'TechImport S.A.' },
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      status: 'confirmed',
      invoice_number: null,
      purchase_date: '2026-08-01T00:00:00Z',
      total_cost: '0.00',
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

describe('AppRouter -- /compras', () => {
  it('renders PurchasesPage at /compras', async () => {
    renderAt('/compras')

    expect(
      await screen.findByText('No hay compras todavía'),
    ).toBeInTheDocument()
  })

  it('renders NewPurchasePage at /compras/nueva', async () => {
    renderAt('/compras/nueva')

    expect(await screen.findByText('Nueva compra')).toBeInTheDocument()
  })

  it('renders PurchaseDetailPage at /compras/:id', async () => {
    renderAt('/compras/some-purchase-id')

    expect(
      await screen.findByText('Compra a TechImport S.A.'),
    ).toBeInTheDocument()
  })

  it('exposes Compras as a real Sidebar link', async () => {
    renderAt('/compras')

    await screen.findByText('No hay compras todavía')
    const purchasesLink = screen.getByRole('link', { name: 'Compras' })
    expect(purchasesLink).toHaveAttribute('href', '/compras')

    // Reportes (F12) was the last placeholder; it is now a real link too,
    // so the Sidebar has no non-navigable buttons left to contrast against.
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })
    expect(reportsLink).toHaveAttribute('href', '/reportes')
  })

  it('marks the Compras link as active when on /compras', async () => {
    renderAt('/compras')

    await screen.findByText('No hay compras todavía')
    const purchasesLink = screen.getByRole('link', { name: 'Compras' })

    await waitFor(() =>
      expect(purchasesLink).toHaveClass('border-primary'),
    )
  })
})
