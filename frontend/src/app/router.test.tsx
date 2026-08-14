import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const EMPTY_SUMMARY = {
  sales_today: {
    sales_count: 0,
    total_amount: '0',
    total_cost: '0',
    total_profit: '0',
  },
  sales_period: {
    sales_count: 0,
    total_amount: '0',
    total_cost: '0',
    total_profit: '0',
  },
  purchases_period: { purchases_count: 0, total_cost: '0' },
  period_date_from: '2026-08-13',
  period_date_to: '2026-08-13',
  active_customers_count: 0,
  active_products_count: 0,
  active_suppliers_count: 0,
}

const server = setupServer(
  http.get(`${BASE_URL}/dashboard/summary`, () => HttpResponse.json(EMPTY_SUMMARY)),
  http.get(`${BASE_URL}/dashboard/sales-overview`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/dashboard/top-products`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/dashboard/top-customers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/dashboard/recent-activity`, () => HttpResponse.json([])),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearTokens()
})
afterAll(() => server.close())

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('AppRouter', () => {
  it('renders the real Dashboard at /', async () => {
    setTokens('access-token', 'refresh-token')
    renderAt('/')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })
    expect(
      screen.queryByText(/vitrina de design tokens/i),
    ).not.toBeInTheDocument()
  })

  it('keeps the F2 showcase reachable at /_showcase, outside the Sidebar', async () => {
    setTokens('access-token', 'refresh-token')
    renderAt('/_showcase')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Application Shell' }),
      ).toBeInTheDocument()
    })

    // The Sidebar has no nav item pointing at /_showcase -- every Sidebar
    // item is wired to a real route (F12 wired the last one, Reportes),
    // and none of them points here.
    expect(
      screen.queryByRole('link', { name: /application shell/i }),
    ).not.toBeInTheDocument()
  })
})
