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
import { ProductStockPage } from './ProductStockPage'

const BASE_URL = 'http://localhost:8000/api/v1'

const SERIAL_PRODUCT_ID = 'prod-serial'
const BATCH_PRODUCT_ID = 'prod-batch'

let units: unknown[] = []
let lastSerialIntakeBody: unknown = null
let lastBatchIntakeBody: unknown = null
let lastAdjustmentBody: unknown = null

function resetData() {
  units = [
    {
      id: 'unit-1',
      product_id: SERIAL_PRODUCT_ID,
      imei: '123456789012345',
      imei2: null,
      status: 'in_stock',
      unit_cost: '500.00',
      location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ]
  lastSerialIntakeBody = null
  lastBatchIntakeBody = null
  lastAdjustmentBody = null
}

interface ProductRecord {
  id: string
  name: string
  sku: string
  tracking_type: string
  is_active: boolean
}

function products(): Record<string, ProductRecord> {
  return {
    [SERIAL_PRODUCT_ID]: {
      id: SERIAL_PRODUCT_ID,
      name: 'iPhone 13',
      sku: 'IPH-13',
      tracking_type: 'serial',
      is_active: true,
    },
    [BATCH_PRODUCT_ID]: {
      id: BATCH_PRODUCT_ID,
      name: 'Cable USB-C',
      sku: 'CBL-USBC',
      tracking_type: 'batch',
      is_active: true,
    },
  }
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/products/:id`, ({ params }) => {
      const product = products()[params.id as string]
      if (!product) {
        return HttpResponse.json({ detail: 'Product not found.' }, { status: 404 })
      }
      return HttpResponse.json(product)
    }),
    http.get(`${BASE_URL}/inventory/products/:id/stock`, ({ params }) => {
      const product = products()[params.id as string]
      return HttpResponse.json({
        product_id: params.id,
        tracking_type: product?.tracking_type ?? 'batch',
        available_quantity: params.id === SERIAL_PRODUCT_ID ? 1 : 50,
      })
    }),
    http.get(`${BASE_URL}/inventory/products/:id/units`, () =>
      HttpResponse.json(units),
    ),
    http.post(`${BASE_URL}/inventory/intake/serial`, async ({ request }) => {
      const body = (await request.json()) as { imei: string }
      lastSerialIntakeBody = body

      if (body.imei === '123456789012345') {
        return HttpResponse.json(
          { detail: 'IMEI already registered.' },
          { status: 409 },
        )
      }

      return HttpResponse.json(
        {
          id: 'unit-2',
          product_id: SERIAL_PRODUCT_ID,
          imei: body.imei,
          imei2: null,
          status: 'in_stock',
          unit_cost: '500.00',
          location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        { status: 201 },
      )
    }),
    http.post(`${BASE_URL}/inventory/intake/batch`, async ({ request }) => {
      lastBatchIntakeBody = await request.json()
      return HttpResponse.json(
        {
          id: 'lot-1',
          product_id: BATCH_PRODUCT_ID,
          lot_code: null,
          quantity_received: 10,
          quantity_available: 10,
          unit_cost: '5.00',
          location: { id: 'loc-1', name: 'Tienda Principal', type: 'store' },
          received_at: '2026-08-13T00:00:00Z',
        },
        { status: 201 },
      )
    }),
    http.post(`${BASE_URL}/inventory/adjustments`, async ({ request }) => {
      const body = await request.json()
      lastAdjustmentBody = body
      return HttpResponse.json({
        product_id: (body as { product_id: string }).product_id,
        tracking_type: 'serial',
        available_quantity: 0,
      })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderProductStockPage(productId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/inventario/${productId}`]}>
        <Routes>
          <Route path="/inventario/:productId" element={<ProductStockPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProductStockPage -- serial product', () => {
  it('renders product header, available quantity and the units table', async () => {
    renderProductStockPage(SERIAL_PRODUCT_ID)

    expect(await screen.findByText('iPhone 13')).toBeInTheDocument()
    expect(screen.getByText('SKU IPH-13')).toBeInTheDocument()
    expect(screen.getByText('Serial (IMEI)')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(await screen.findByText('123456789012345')).toBeInTheDocument()
  })

  it('registers a serial intake and closes the modal', async () => {
    const user = userEvent.setup()
    renderProductStockPage(SERIAL_PRODUCT_ID)

    await screen.findByText('iPhone 13')
    await user.click(screen.getByRole('button', { name: 'Nueva entrada' }))
    await user.type(screen.getByLabelText('IMEI'), '999999999999999')
    await user.type(screen.getByLabelText('Costo unitario'), '450')
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Registrar entrada' }),
      ).not.toBeInTheDocument(),
    )
    expect(lastSerialIntakeBody).toEqual(
      expect.objectContaining({
        product_id: SERIAL_PRODUCT_ID,
        imei: '999999999999999',
        unit_cost: '450',
      }),
    )
    expect(lastSerialIntakeBody).not.toHaveProperty('location_id')
  })

  it('shows the real backend 409 message on a duplicate IMEI, verbatim', async () => {
    const user = userEvent.setup()
    renderProductStockPage(SERIAL_PRODUCT_ID)

    await screen.findByText('iPhone 13')
    await user.click(screen.getByRole('button', { name: 'Nueva entrada' }))
    await user.type(screen.getByLabelText('IMEI'), '123456789012345')
    await user.type(screen.getByLabelText('Costo unitario'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))

    expect(
      await screen.findByText('IMEI already registered.'),
    ).toBeInTheDocument()
  })

  it('adjusts a serial unit to defective', async () => {
    const user = userEvent.setup()
    renderProductStockPage(SERIAL_PRODUCT_ID)

    await screen.findByText('iPhone 13')
    await user.click(screen.getByRole('button', { name: 'Ajustar stock' }))
    await user.type(screen.getByLabelText('IMEI'), '123456789012345')
    await user.selectOptions(
      screen.getByLabelText('Nuevo estado'),
      'Defectuoso',
    )
    await user.click(screen.getByRole('button', { name: 'Ajustar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Ajustar' }),
      ).not.toBeInTheDocument(),
    )
    expect(lastAdjustmentBody).toEqual(
      expect.objectContaining({
        product_id: SERIAL_PRODUCT_ID,
        direction: 'out',
        imei: '123456789012345',
        new_status: 'defective',
      }),
    )
  })
})

describe('ProductStockPage -- batch product', () => {
  it('renders available quantity without a units table', async () => {
    renderProductStockPage(BATCH_PRODUCT_ID)

    expect(await screen.findByText('Cable USB-C')).toBeInTheDocument()
    expect(screen.getByText('Lote')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.queryByText('Unidades')).not.toBeInTheDocument()
  })

  it('registers a batch intake', async () => {
    const user = userEvent.setup()
    renderProductStockPage(BATCH_PRODUCT_ID)

    await screen.findByText('Cable USB-C')
    await user.click(screen.getByRole('button', { name: 'Nueva entrada' }))
    await user.type(screen.getByLabelText('Cantidad'), '20')
    await user.type(screen.getByLabelText('Costo unitario'), '3.5')
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Registrar entrada' }),
      ).not.toBeInTheDocument(),
    )
    expect(lastBatchIntakeBody).toEqual(
      expect.objectContaining({
        product_id: BATCH_PRODUCT_ID,
        quantity: 20,
        unit_cost: '3.5',
      }),
    )
  })

  it('requires unit_cost only for inbound batch adjustments', async () => {
    const user = userEvent.setup()
    renderProductStockPage(BATCH_PRODUCT_ID)

    await screen.findByText('Cable USB-C')
    await user.click(screen.getByRole('button', { name: 'Ajustar stock' }))
    await user.type(screen.getByLabelText('Cantidad'), '5')
    await user.click(screen.getByRole('button', { name: 'Ajustar' }))

    expect(
      await screen.findByText('Requerido para ajustes de entrada.'),
    ).toBeInTheDocument()
  })

  it('adjusts an outbound batch quantity without a unit_cost field', async () => {
    const user = userEvent.setup()
    renderProductStockPage(BATCH_PRODUCT_ID)

    await screen.findByText('Cable USB-C')
    await user.click(screen.getByRole('button', { name: 'Ajustar stock' }))
    await user.selectOptions(screen.getByLabelText('Dirección'), 'Salida')
    expect(screen.queryByLabelText('Costo unitario')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Cantidad'), '5')
    await user.click(screen.getByRole('button', { name: 'Ajustar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Ajustar' }),
      ).not.toBeInTheDocument(),
    )
    expect(lastAdjustmentBody).toEqual(
      expect.objectContaining({
        product_id: BATCH_PRODUCT_ID,
        direction: 'out',
        quantity: 5,
        unit_cost: null,
      }),
    )
  })
})

describe('ProductStockPage -- permissions', () => {
  it('shows a 403 empty state when the stock endpoint is forbidden', async () => {
    server.use(
      http.get(`${BASE_URL}/inventory/products/:id/stock`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderProductStockPage(SERIAL_PRODUCT_ID)

    expect(
      await screen.findByText(
        'No tienes permiso para ver el stock de este producto',
      ),
    ).toBeInTheDocument()
  })
})
