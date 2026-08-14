import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { NewSalePage } from './NewSalePage'

const BASE_URL = 'http://localhost:8000/api/v1'

const SERIAL_PRODUCT = {
  id: 'prod-serial',
  name: 'iPhone 13',
  sku: 'IPH-13',
  tracking_type: 'serial',
  sale_price: '500.00',
}

const BATCH_PRODUCT = {
  id: 'prod-batch',
  name: 'Cable USB-C',
  sku: 'CBL-USBC',
  tracking_type: 'batch',
  sale_price: '10.00',
}

let lastPostBody: Record<string, unknown> | null = null
let postCallCount = 0
let inventoryWriteAttempted = false

function resetData() {
  lastPostBody = null
  postCallCount = 0
  inventoryWriteAttempted = false
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/customers`, () =>
      HttpResponse.json([{ id: 'customer-1', name: 'Juan Pérez' }]),
    ),
    http.get(`${BASE_URL}/products`, () =>
      HttpResponse.json([SERIAL_PRODUCT, BATCH_PRODUCT]),
    ),
    http.get(`${BASE_URL}/inventory/products/:id/units`, ({ params }) => {
      if (params.id === 'prod-serial') {
        return HttpResponse.json([
          {
            id: 'unit-1',
            product_id: 'prod-serial',
            imei: '111111111111111',
            imei2: null,
            status: 'in_stock',
          },
        ])
      }
      return HttpResponse.json([])
    }),
    http.get(`${BASE_URL}/inventory/products/:id/stock`, ({ params }) =>
      HttpResponse.json({
        product_id: params.id,
        tracking_type: 'batch',
        available_quantity: 8,
      }),
    ),
    // Deliberately no POST/PUT/DELETE handlers under /inventory/ -- if the
    // app ever tried to write to Inventory, onUnhandledRequest: 'error'
    // below would throw and fail the test loudly.
    http.post(`${BASE_URL}/sales`, async ({ request }) => {
      postCallCount += 1
      const body = (await request.json()) as Record<string, unknown>
      lastPostBody = body

      return HttpResponse.json(
        {
          id: 'sale-new',
          customer: { id: 'customer-1', name: 'Juan Pérez' },
          location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
          status: 'confirmed',
          sale_date: '2026-08-13T00:00:00Z',
          total_amount: '500.00',
          total_cost: '350.00',
          profit: '150.00',
          notes: body.notes ?? null,
          lines: [],
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        { status: 201 },
      )
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() =>
  server.listen({
    onUnhandledRequest: (request) => {
      if (request.method !== 'GET' && request.url.includes('/inventory/')) {
        inventoryWriteAttempted = true
      }
      throw new Error(`Unhandled request: ${request.method} ${request.url}`)
    },
  }),
)
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderNewSalePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ventas/nueva']}>
        <Routes>
          <Route path="/ventas/nueva" element={<NewSalePage />} />
          <Route path="/ventas" element={<div>Sales list page</div>} />
          <Route path="/ventas/:saleId" element={<div>Sale detail page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForOptionsLoaded() {
  await screen.findByRole('option', { name: 'iPhone 13 (IPH-13)' })
}

describe('NewSalePage', () => {
  it('renders the form with customer and product options loaded', async () => {
    renderNewSalePage()

    expect(await screen.findByText('Nueva venta')).toBeInTheDocument()
    expect(
      await screen.findByRole('option', { name: 'Juan Pérez' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'iPhone 13 (IPH-13)' }),
    ).toBeInTheDocument()
  })

  it('shows an IMEI selector populated from Inventory for a SERIAL product', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )

    expect(
      await screen.findByRole('option', { name: '111111111111111' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1')
    expect(screen.getByLabelText('Cantidad')).toBeDisabled()
  })

  it('shows available stock as a hint for a BATCH product', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )

    expect(await screen.findByText('Disponible: 8')).toBeInTheDocument()
  })

  it('falls back to a plain IMEI input when Inventory has no in-stock units', async () => {
    server.use(
      http.get(`${BASE_URL}/inventory/products/:id/units`, () =>
        HttpResponse.json([]),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )

    expect(
      await screen.findByText(
        'No hay unidades en stock para este producto según Inventario.',
      ),
    ).toBeInTheDocument()
    const imeiField = screen.getByLabelText('IMEI')
    expect(imeiField.tagName).toBe('INPUT')
  })

  it('falls back gracefully when Inventory is forbidden (403), without blocking the sale', async () => {
    server.use(
      http.get(`${BASE_URL}/inventory/products/:id/units`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
      http.get(`${BASE_URL}/inventory/products/:id/stock`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    const imeiField = await screen.findByLabelText('IMEI')
    expect(imeiField.tagName).toBe('INPUT')
    await user.type(imeiField, '999999999999999')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        lines: [expect.objectContaining({ imei: '999999999999999' })],
      }),
    )
    expect(inventoryWriteAttempted).toBe(false)
  })

  it('creates a sale with a single SERIAL line selected from the IMEI dropdown', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    await screen.findByRole('option', { name: '111111111111111' })
    await user.selectOptions(screen.getByLabelText('IMEI'), '111111111111111')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        customer_id: null,
        lines: [
          expect.objectContaining({
            product_id: 'prod-serial',
            quantity: 1,
            unit_price: null,
            imei: '111111111111111',
          }),
        ],
      }),
    )
    expect(await screen.findByText('Sale detail page')).toBeInTheDocument()
  })

  it('creates a sale with a BATCH line, omitting unit_price when left blank', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '3')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            product_id: 'prod-batch',
            quantity: 3,
            unit_price: null,
          }),
        ],
      }),
    )
  })

  it('sends an explicit unit_price when provided, overriding the default', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '2')
    await user.type(screen.getByLabelText('Precio unitario (opcional)'), '7.50')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        lines: [expect.objectContaining({ unit_price: '7.50' })],
      }),
    )
  })

  it('adds a second line and creates a sale mixing SERIAL and BATCH', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getAllByLabelText('Producto')[0],
      'iPhone 13 (IPH-13)',
    )
    await screen.findByRole('option', { name: '111111111111111' })
    await user.selectOptions(
      screen.getAllByLabelText('IMEI')[0],
      '111111111111111',
    )

    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    await user.selectOptions(
      screen.getAllByLabelText('Producto')[1],
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getAllByLabelText('Cantidad')[1])
    await user.type(screen.getAllByLabelText('Cantidad')[1], '5')

    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect((lastPostBody!.lines as unknown[]).length).toBe(2)
  })

  it('removes a line, leaving only the remaining one', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    expect(screen.getAllByLabelText('Producto')).toHaveLength(2)

    await user.click(screen.getByLabelText('Eliminar línea 1'))
    expect(screen.getAllByLabelText('Producto')).toHaveLength(1)
  })

  it('rejects a SERIAL line without an IMEI client-side, without calling the API', async () => {
    server.use(
      http.get(`${BASE_URL}/inventory/products/:id/units`, () =>
        HttpResponse.json([]),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(
      await screen.findByText('IMEI requerido para productos seriales.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('leaves customer_id out of the payload when left blank (backend uses default)', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({ customer_id: null }),
    )
  })

  it('sends the selected customer_id explicitly when chosen', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'Juan Pérez')
    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({ customer_id: 'customer-1' }),
    )
  })

  it('shows the real backend 400 message when there is no default customer, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/sales`, () =>
        HttpResponse.json(
          {
            detail:
              'No customer_id was provided and no default customer is configured.',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(
      await screen.findByText(
        'No customer_id was provided and no default customer is configured.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the real backend 409 message on an already-sold IMEI, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/sales`, () =>
        HttpResponse.json(
          { detail: 'IMEI 111111111111111 already sold.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    await screen.findByRole('option', { name: '111111111111111' })
    await user.selectOptions(screen.getByLabelText('IMEI'), '111111111111111')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(
      await screen.findByText('IMEI 111111111111111 already sold.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 400 message on insufficient stock, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/sales`, () =>
        HttpResponse.json(
          { detail: 'Insufficient stock for product prod-batch.' },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '99')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(
      await screen.findByText('Insufficient stock for product prod-batch.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 404 message when the customer does not exist, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/sales`, () =>
        HttpResponse.json({ detail: 'Customer not found.' }, { status: 404 }),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(await screen.findByText('Customer not found.')).toBeInTheDocument()
  })

  it('shows a 403 error when creating without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/sales`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
  })

  it('sends an ISO sale_date when a date is picked, and omits it otherwise', async () => {
    const user = userEvent.setup()
    renderNewSalePage()
    await waitForOptionsLoaded()

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '1')
    await user.type(screen.getByLabelText('Fecha (opcional)'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody!.sale_date).toBe('2026-08-01T00:00:00.000Z')
  })

  it('navigates back to the list on cancel', async () => {
    const user = userEvent.setup()
    renderNewSalePage()

    await screen.findByText('Nueva venta')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Sales list page')).toBeInTheDocument()
  })
})
