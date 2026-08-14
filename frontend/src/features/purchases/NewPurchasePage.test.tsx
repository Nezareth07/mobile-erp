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
import { NewPurchasePage } from './NewPurchasePage'

const BASE_URL = 'http://localhost:8000/api/v1'

const SERIAL_PRODUCT = {
  id: 'prod-serial',
  name: 'iPhone 13',
  sku: 'IPH-13',
  tracking_type: 'serial',
}

const BATCH_PRODUCT = {
  id: 'prod-batch',
  name: 'Cable USB-C',
  sku: 'CBL-USBC',
  tracking_type: 'batch',
}

let lastPostBody: Record<string, unknown> | null = null
let postCallCount = 0

function resetData() {
  lastPostBody = null
  postCallCount = 0
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/suppliers`, () =>
      HttpResponse.json([{ id: 'supplier-1', name: 'TechImport S.A.' }]),
    ),
    http.get(`${BASE_URL}/products`, () =>
      HttpResponse.json([SERIAL_PRODUCT, BATCH_PRODUCT]),
    ),
    http.post(`${BASE_URL}/purchases`, async ({ request }) => {
      postCallCount += 1
      const body = (await request.json()) as Record<string, unknown>
      lastPostBody = body

      return HttpResponse.json(
        {
          id: 'purchase-new',
          supplier: { id: 'supplier-1', name: 'TechImport S.A.' },
          location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
          status: 'confirmed',
          invoice_number: body.invoice_number ?? null,
          purchase_date: '2026-08-13T00:00:00Z',
          total_cost: '500.00',
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderNewPurchasePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/compras/nueva']}>
        <Routes>
          <Route path="/compras/nueva" element={<NewPurchasePage />} />
          <Route path="/compras" element={<div>Purchases list page</div>} />
          <Route
            path="/compras/:purchaseId"
            element={<div>Purchase detail page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function selectSupplier(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: 'TechImport S.A.' })
  // Also wait for the product options query (fired in parallel on mount)
  // before any test interacts with a product <Select> -- otherwise
  // selectOptions on a still-empty select silently no-ops.
  await screen.findByRole('option', { name: 'iPhone 13 (IPH-13)' })
  await user.selectOptions(
    screen.getByLabelText('Proveedor'),
    'TechImport S.A.',
  )
}

describe('NewPurchasePage', () => {
  it('renders the form with supplier and product options loaded', async () => {
    renderNewPurchasePage()

    expect(await screen.findByText('Nueva compra')).toBeInTheDocument()
    expect(
      await screen.findByRole('option', { name: 'TechImport S.A.' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('option', { name: 'iPhone 13 (IPH-13)' }),
    ).toBeInTheDocument()
  })

  it('creates a purchase with a single SERIAL line, auto-locking quantity to 1', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1')
    expect(screen.getByLabelText('Cantidad')).toBeDisabled()

    await user.type(screen.getByLabelText('IMEI'), '999999999999999')
    await user.type(screen.getByLabelText('Costo unitario'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        supplier_id: 'supplier-1',
        lines: [
          expect.objectContaining({
            product_id: 'prod-serial',
            quantity: 1,
            unit_cost: '500',
            imei: '999999999999999',
            imei2: null,
            lot_code: null,
          }),
        ],
      }),
    )
    expect(await screen.findByText('Purchase detail page')).toBeInTheDocument()
  })

  it('creates a purchase with a single BATCH line, including an optional lot_code', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '20')
    await user.type(screen.getByLabelText('Costo unitario'), '3.5')
    await user.type(
      screen.getByLabelText('Código de lote (opcional)'),
      'LOTE-01',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            product_id: 'prod-batch',
            quantity: 20,
            unit_cost: '3.5',
            imei: null,
            imei2: null,
            lot_code: 'LOTE-01',
          }),
        ],
      }),
    )
  })

  it('adds a second line and creates a purchase mixing SERIAL and BATCH', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)

    await user.selectOptions(
      screen.getAllByLabelText('Producto')[0],
      'iPhone 13 (IPH-13)',
    )
    await user.type(screen.getAllByLabelText('IMEI')[0], '111111111111111')
    await user.type(screen.getAllByLabelText('Costo unitario')[0], '500')

    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    await user.selectOptions(
      screen.getAllByLabelText('Producto')[1],
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getAllByLabelText('Cantidad')[1])
    await user.type(screen.getAllByLabelText('Cantidad')[1], '10')
    await user.type(screen.getAllByLabelText('Costo unitario')[1], '5')

    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    await waitFor(() => expect(postCallCount).toBe(1))
    expect((lastPostBody!.lines as unknown[]).length).toBe(2)
    expect(lastPostBody).toEqual(
      expect.objectContaining({
        lines: [
          expect.objectContaining({ product_id: 'prod-serial', quantity: 1 }),
          expect.objectContaining({ product_id: 'prod-batch', quantity: 10 }),
        ],
      }),
    )
  })

  it('removes a line, leaving only the remaining one at submit time', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)

    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    expect(screen.getAllByLabelText('Producto')).toHaveLength(2)

    await user.click(screen.getByLabelText('Eliminar línea 1'))
    expect(screen.getAllByLabelText('Producto')).toHaveLength(1)
  })

  it('disables removing the last remaining line', async () => {
    renderNewPurchasePage()

    expect(await screen.findByLabelText('Eliminar línea 1')).toBeDisabled()
  })

  it('rejects submission without a supplier, without calling the API', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()

    await screen.findByRole('option', { name: 'iPhone 13 (IPH-13)' })
    await user.selectOptions(screen.getByLabelText('Producto'), 'iPhone 13 (IPH-13)')
    await user.type(screen.getByLabelText('IMEI'), '999999999999999')
    await user.type(screen.getByLabelText('Costo unitario'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(
      await screen.findByText('Selecciona un proveedor.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('rejects a SERIAL line without an IMEI client-side, without calling the API', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)

    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    await user.type(screen.getByLabelText('Costo unitario'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(
      await screen.findByText('IMEI requerido para productos seriales.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('shows the real backend 404 message when the supplier does not exist, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/purchases`, () =>
        HttpResponse.json({ detail: 'Supplier not found.' }, { status: 404 }),
      ),
    )
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)
    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '10')
    await user.type(screen.getByLabelText('Costo unitario'), '5')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(await screen.findByText('Supplier not found.')).toBeInTheDocument()
  })

  it('shows the real backend 400 message on an inactive supplier, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/purchases`, () =>
        HttpResponse.json(
          { detail: 'Supplier is not active.' },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)
    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '10')
    await user.type(screen.getByLabelText('Costo unitario'), '5')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(
      await screen.findByText('Supplier is not active.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 409 message on an already-registered IMEI, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/purchases`, () =>
        HttpResponse.json(
          { detail: 'IMEI 999999999999999 already registered.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)
    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'iPhone 13 (IPH-13)',
    )
    await user.type(screen.getByLabelText('IMEI'), '999999999999999')
    await user.type(screen.getByLabelText('Costo unitario'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(
      await screen.findByText('IMEI 999999999999999 already registered.'),
    ).toBeInTheDocument()
  })

  it('shows a 403 error when creating without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/purchases`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderNewPurchasePage()
    await selectSupplier(user)
    await user.selectOptions(
      screen.getByLabelText('Producto'),
      'Cable USB-C (CBL-USBC)',
    )
    await user.clear(screen.getByLabelText('Cantidad'))
    await user.type(screen.getByLabelText('Cantidad'), '10')
    await user.type(screen.getByLabelText('Costo unitario'), '5')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
  })

  it('navigates back to the list on cancel', async () => {
    const user = userEvent.setup()
    renderNewPurchasePage()

    await screen.findByText('Nueva compra')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Purchases list page')).toBeInTheDocument()
  })
})
