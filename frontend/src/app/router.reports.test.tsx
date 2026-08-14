import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const EMPTY_SALES_SUMMARY = {
  sales_count: 0,
  total_amount: '0',
  total_cost: '0',
  total_profit: '0',
  profit_margin: null,
}

const EMPTY_PURCHASES_SUMMARY = {
  purchases_count: 0,
  total_cost: '0',
}

// Same lesson already applied in router.administration.test.tsx (F11) and
// router.sales.test.tsx (F10): App.tsx's module-level QueryClient uses
// TanStack Query's default retry, so error responses take several
// seconds to settle here. This file only needs 200 responses to prove
// each route wires to the right component; loading/empty/403 states are
// covered in isolation in SalesReportPage.test.tsx and
// PurchasesReportPage.test.tsx (with retry disabled there).
const server = setupServer(
  http.get(`${BASE_URL}/reports/sales/summary`, () =>
    HttpResponse.json(EMPTY_SALES_SUMMARY),
  ),
  http.get(`${BASE_URL}/reports/sales/timeseries`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE_URL}/reports/sales/top-products`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE_URL}/reports/sales/top-customers`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE_URL}/reports/purchases/summary`, () =>
    HttpResponse.json(EMPTY_PURCHASES_SUMMARY),
  ),
  http.get(`${BASE_URL}/reports/purchases/timeseries`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE_URL}/reports/purchases/top-suppliers`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${BASE_URL}/reports/purchases/top-products`, () =>
    HttpResponse.json([]),
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

describe('AppRouter -- /reportes', () => {
  it('redirects /reportes to /reportes/ventas', async () => {
    renderAt('/reportes')

    expect(
      await screen.findByRole('heading', { name: 'Reportes de ventas' }),
    ).toBeInTheDocument()
  })

  it('renders SalesReportPage at /reportes/ventas', async () => {
    renderAt('/reportes/ventas')

    expect(
      await screen.findByRole('heading', { name: 'Reportes de ventas' }),
    ).toBeInTheDocument()
  })

  it('renders PurchasesReportPage at /reportes/compras', async () => {
    renderAt('/reportes/compras')

    expect(
      await screen.findByRole('heading', { name: 'Reportes de compras' }),
    ).toBeInTheDocument()
  })

  it('exposes Reportes as a real Sidebar link', async () => {
    renderAt('/reportes')

    await screen.findByRole('heading', { name: 'Reportes de ventas' })
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })
    expect(reportsLink).toHaveAttribute('href', '/reportes')
  })

  it('marks the Reportes link and Ventas tab as active', async () => {
    renderAt('/reportes/ventas')

    await screen.findByRole('heading', { name: 'Reportes de ventas' })
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })

    await waitFor(() => expect(reportsLink).toHaveClass('border-primary'))

    // The tab bar re-uses "Ventas"/"Compras" as labels, same as the
    // Sidebar's own top-level links -- disambiguated here via the
    // "Reportes" navigation landmark, exactly as assistive tech would.
    const tabsNav = screen.getByRole('navigation', { name: 'Reportes' })
    const salesTab = within(tabsNav).getByRole('link', { name: 'Ventas' })
    expect(salesTab).toHaveClass('border-primary')
  })

  it('marks the Compras tab as active at /reportes/compras', async () => {
    renderAt('/reportes/compras')

    await screen.findByRole('heading', { name: 'Reportes de compras' })

    const tabsNav = screen.getByRole('navigation', { name: 'Reportes' })
    const purchasesTab = within(tabsNav).getByRole('link', {
      name: 'Compras',
    })
    await waitFor(() => expect(purchasesTab).toHaveClass('border-primary'))
  })
})
