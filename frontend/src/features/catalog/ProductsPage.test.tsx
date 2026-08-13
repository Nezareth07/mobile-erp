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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { ProductsPage } from './ProductsPage'
import { formatCurrency } from './format'

const BASE_URL = 'http://localhost:8000/api/v1'

// Intl.NumberFormat inserts a non-breaking space (U+00A0) between "USD"
// and the amount; Testing Library's default text normalizer collapses it
// to a regular space when reading the DOM but not on the raw matcher
// string -- same fix already applied in features/dashboard's tests.
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function currencyText(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

const SAMPLE_BRANDS = [
  {
    id: 'brand-1',
    name: 'Apple',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
]

const SAMPLE_CATEGORIES = [
  {
    id: 'cat-1',
    name: 'Smartphones',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
]

interface ProductRecord {
  id: string
  name: string
  description: string | null
  sku: string
  tracking_type: string
  cost_price: string
  sale_price: string
  is_active: boolean
  brand: { id: string; name: string }
  category: { id: string; name: string }
  created_at: string
  updated_at: string
}

let products: ProductRecord[] = []
let lastPostBody: unknown = null
let lastPutBody: unknown = null

function resetData() {
  products = [
    {
      id: 'prod-1',
      name: 'iPhone 15',
      description: null,
      sku: 'PHN-IPH15-128BLK',
      tracking_type: 'serial',
      cost_price: '600.00',
      sale_price: '899.00',
      is_active: true,
      brand: { id: 'brand-1', name: 'Apple' },
      category: { id: 'cat-1', name: 'Smartphones' },
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ]
  lastPostBody = null
  lastPutBody = null
}

function referenceHandlers() {
  return [
    http.get(`${BASE_URL}/brands`, () => HttpResponse.json(SAMPLE_BRANDS)),
    http.get(`${BASE_URL}/categories`, () =>
      HttpResponse.json(SAMPLE_CATEGORIES),
    ),
  ]
}

function defaultHandlers() {
  return [
    ...referenceHandlers(),
    http.get(`${BASE_URL}/products`, () => HttpResponse.json(products)),
    http.post(`${BASE_URL}/products`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      lastPostBody = body

      if (products.some((product) => product.sku === body.sku)) {
        return HttpResponse.json(
          { detail: 'SKU already exists.' },
          { status: 409 },
        )
      }

      const created: ProductRecord = {
        id: 'prod-2',
        name: body.name as string,
        description: (body.description as string | null) ?? null,
        sku: body.sku as string,
        tracking_type: body.tracking_type as string,
        cost_price: body.cost_price as string,
        sale_price: body.sale_price as string,
        is_active: true,
        brand: SAMPLE_BRANDS[0],
        category: SAMPLE_CATEGORIES[0],
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      }
      products = [...products, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/products/:id`, async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      lastPutBody = body
      products = products.map((product) =>
        product.id === params.id
          ? { ...product, name: body.name as string }
          : product,
      )
      return HttpResponse.json(products.find((p) => p.id === params.id))
    }),
    http.delete(`${BASE_URL}/products/:id`, ({ params }) => {
      products = products.filter((product) => product.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderProductsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductsPage />
    </QueryClientProvider>,
  )
}

describe('ProductsPage', () => {
  it('renders the list with real product fields', async () => {
    renderProductsPage()

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByText('PHN-IPH15-128BLK')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Smartphones')).toBeInTheDocument()
    expect(screen.getByText(currencyText('899.00'))).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/products`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(products)
      }),
    )
    const { container } = renderProductsPage()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(await screen.findByText('iPhone 15')).toBeInTheDocument()
  })

  it('shows an empty state when there are no products', async () => {
    server.use(http.get(`${BASE_URL}/products`, () => HttpResponse.json([])))
    renderProductsPage()

    expect(
      await screen.findByText('No hay productos todavía'),
    ).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/products`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderProductsPage()

    expect(
      await screen.findByText('No se pudieron cargar los productos'),
    ).toBeInTheDocument()
  })

  it('shows a 403 state for the products list', async () => {
    server.use(
      http.get(`${BASE_URL}/products`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderProductsPage()

    expect(
      await screen.findByText('No tienes permiso para ver productos'),
    ).toBeInTheDocument()
  })

  it('validates required brand/category and the sale >= cost price rule client-side', async () => {
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByText('Nuevo producto'))

    await user.type(screen.getByLabelText('Nombre'), 'Galaxy S25')
    await user.type(screen.getByLabelText('SKU'), 'PHN-GLX25')
    await user.type(screen.getByLabelText('Precio de costo'), '500')
    await user.type(screen.getByLabelText('Precio de venta'), '400')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Selecciona una marca.')).toBeInTheDocument()
    expect(screen.getByText('Selecciona una categoría.')).toBeInTheDocument()
    expect(
      screen.getByText('El precio de venta no puede ser menor al precio de costo.'),
    ).toBeInTheDocument()
  })

  it('creates a product with the real field set and refetches the list', async () => {
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByText('Nuevo producto'))

    await user.type(screen.getByLabelText('Nombre'), 'Galaxy S25')
    await user.type(screen.getByLabelText('SKU'), 'PHN-GLX25')
    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-1')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'cat-1')
    await user.selectOptions(
      screen.getByLabelText('Tipo de seguimiento'),
      'serial',
    )
    await user.type(screen.getByLabelText('Precio de costo'), '500')
    await user.type(screen.getByLabelText('Precio de venta'), '750')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Galaxy S25')).toBeInTheDocument()
    expect(lastPostBody).toEqual({
      name: 'Galaxy S25',
      description: null,
      sku: 'PHN-GLX25',
      brand_id: 'brand-1',
      category_id: 'cat-1',
      tracking_type: 'serial',
      cost_price: '500',
      sale_price: '750',
    })
  })

  it('edits a product and reflects the change after refetch', async () => {
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByLabelText('Editar iPhone 15'))

    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'iPhone 15 Pro')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument()
    expect(lastPutBody).toMatchObject({ name: 'iPhone 15 Pro' })
  })

  it('keeps an inactive brand selectable in edit mode and does not block saving other fields', async () => {
    // iPhone 15 belongs to brand-1, but the active list no longer includes
    // it -- reproduces the "brand deactivated after assignment" case.
    server.use(
      http.get(`${BASE_URL}/brands`, () =>
        HttpResponse.json([
          {
            id: 'brand-2',
            name: 'Samsung',
            is_active: true,
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByLabelText('Editar iPhone 15'))

    const brandSelect = screen.getByLabelText('Marca') as HTMLSelectElement
    expect(brandSelect.value).toBe('brand-1')
    expect(screen.getByText('Apple (inactiva)')).toBeInTheDocument()
    expect(brandSelect).not.toBeDisabled()

    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'iPhone 15 (editado)')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.queryByText('Selecciona una marca.')).not.toBeInTheDocument()
    expect(await screen.findByText('iPhone 15 (editado)')).toBeInTheDocument()
    expect(lastPutBody).toMatchObject({ brand_id: 'brand-1' })
  })

  it('keeps an inactive category selectable in edit mode and does not block saving other fields', async () => {
    server.use(
      http.get(`${BASE_URL}/categories`, () =>
        HttpResponse.json([
          {
            id: 'cat-2',
            name: 'Accesorios',
            is_active: true,
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByLabelText('Editar iPhone 15'))

    const categorySelect = screen.getByLabelText('Categoría') as HTMLSelectElement
    expect(categorySelect.value).toBe('cat-1')
    expect(screen.getByText('Smartphones (inactiva)')).toBeInTheDocument()
    expect(categorySelect).not.toBeDisabled()

    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'iPhone 15 (editado)')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      screen.queryByText('Selecciona una categoría.'),
    ).not.toBeInTheDocument()
    expect(await screen.findByText('iPhone 15 (editado)')).toBeInTheDocument()
    expect(lastPutBody).toMatchObject({ category_id: 'cat-1' })
  })

  it('soft-deletes a product after confirmation', async () => {
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByLabelText('Eliminar iPhone 15'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(screen.queryByText('iPhone 15')).not.toBeInTheDocument(),
    )
  })

  it('shows a 403 error inside the modal on write without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/products`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByText('Nuevo producto'))
    await user.type(screen.getByLabelText('Nombre'), 'Galaxy S25')
    await user.type(screen.getByLabelText('SKU'), 'PHN-GLX25')
    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-1')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'cat-1')
    await user.type(screen.getByLabelText('Precio de costo'), '500')
    await user.type(screen.getByLabelText('Precio de venta'), '750')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate SKU, verbatim', async () => {
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByText('Nuevo producto'))
    await user.type(screen.getByLabelText('Nombre'), 'Otro iPhone')
    await user.type(screen.getByLabelText('SKU'), 'PHN-IPH15-128BLK')
    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-1')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'cat-1')
    await user.type(screen.getByLabelText('Precio de costo'), '500')
    await user.type(screen.getByLabelText('Precio de venta'), '750')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('SKU already exists.')).toBeInTheDocument()
  })

  it('disables the brand select and hints when there are no active brands', async () => {
    server.use(http.get(`${BASE_URL}/brands`, () => HttpResponse.json([])))
    const user = userEvent.setup()
    renderProductsPage()

    await screen.findByText('iPhone 15')
    await user.click(screen.getByText('Nuevo producto'))

    expect(
      await screen.findByText(
        'No hay marcas activas. Crea una primero en Catálogo → Marcas.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Marca')).toBeDisabled()
  })
})
