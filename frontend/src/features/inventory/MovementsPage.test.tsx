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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MovementsPage } from './MovementsPage'
import { nextIsoDate, todayIsoDate } from './dateRange'

const BASE_URL = 'http://localhost:8000/api/v1'

let movements: unknown[] = []
let lastMovementsUrl: URL | null = null

function resetData() {
  movements = [
    {
      id: 'move-1',
      product: { id: 'prod-1', name: 'iPhone 13', sku: 'IPH-13' },
      movement_type: 'adjustment_in',
      quantity: 1,
      unit_cost: '500.00',
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      source_type: 'manual',
      source_reference: null,
      notes: null,
      created_at: '2026-08-13T10:00:00Z',
    },
  ]
  lastMovementsUrl = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/reports/inventory/movements`, ({ request }) => {
      lastMovementsUrl = new URL(request.url)
      return HttpResponse.json(movements)
    }),
    http.get(`${BASE_URL}/products`, () =>
      HttpResponse.json([
        {
          id: 'prod-1',
          name: 'iPhone 13',
          sku: 'IPH-13',
          tracking_type: 'serial',
          is_active: true,
        },
      ]),
    ),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderMovementsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MovementsPage />
    </QueryClientProvider>,
  )
}

describe('MovementsPage', () => {
  it('renders the movements list with real data', async () => {
    renderMovementsPage()

    expect(
      (await screen.findAllByText('iPhone 13')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Ajuste (entrada)').length,
    ).toBeGreaterThan(0)
  })

  it('sends date_from/date_to as an exclusive range on first load', async () => {
    renderMovementsPage()

    await screen.findByText('Ajuste (entrada)')
    expect(lastMovementsUrl).not.toBeNull()
    const params = lastMovementsUrl!.searchParams
    const today = todayIsoDate()
    expect(params.get('date_from')).toBe(today)
    expect(params.get('date_to')).toBe(nextIsoDate(today))
    expect(params.get('limit')).toBe('20')
    expect(params.get('offset')).toBe('0')
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/inventory/movements`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderMovementsPage()

    expect(
      await screen.findByText('No tienes permiso para ver los movimientos'),
    ).toBeInTheDocument()
  })

  it('shows an empty state with no movements in range', async () => {
    server.use(
      http.get(`${BASE_URL}/reports/inventory/movements`, () =>
        HttpResponse.json([]),
      ),
    )
    renderMovementsPage()

    expect(
      await screen.findByText(
        'Sin movimientos en el rango y filtros seleccionados',
      ),
    ).toBeInTheDocument()
  })

  it('disables "Anterior" on the first page and "Siguiente" when a page is not full', async () => {
    renderMovementsPage()

    expect(
      await screen.findByRole('button', { name: 'Anterior' }),
    ).toBeDisabled()
    expect(
      await screen.findByRole('button', { name: 'Siguiente' }),
    ).toBeDisabled()
  })
})
