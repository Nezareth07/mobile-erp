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
import { BrandsPage } from './BrandsPage'

const BASE_URL = 'http://localhost:8000/api/v1'

interface BrandRecord {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

let brands: BrandRecord[] = []
let postCallCount = 0
let lastPostBody: unknown = null
let lastPutBody: unknown = null

function resetData() {
  brands = [
    {
      id: 'brand-1',
      name: 'Apple',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'brand-2',
      name: 'Samsung',
      is_active: true,
      created_at: '2026-08-02T00:00:00Z',
      updated_at: '2026-08-02T00:00:00Z',
    },
  ]
  postCallCount = 0
  lastPostBody = null
  lastPutBody = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/brands`, () => HttpResponse.json(brands)),
    http.post(`${BASE_URL}/brands`, async ({ request }) => {
      postCallCount += 1
      const body = (await request.json()) as { name: string }
      lastPostBody = body

      if (brands.some((brand) => brand.name === body.name)) {
        return HttpResponse.json(
          { detail: 'Brand already exists.' },
          { status: 409 },
        )
      }

      const created: BrandRecord = {
        id: `brand-${brands.length + 1}`,
        name: body.name,
        is_active: true,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      }
      brands = [...brands, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/brands/:id`, async ({ request, params }) => {
      const body = (await request.json()) as { name: string }
      lastPutBody = body
      brands = brands.map((brand) =>
        brand.id === params.id ? { ...brand, name: body.name } : brand,
      )
      const updated = brands.find((brand) => brand.id === params.id)
      return HttpResponse.json(updated)
    }),
    http.delete(`${BASE_URL}/brands/:id`, ({ params }) => {
      brands = brands.filter((brand) => brand.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderBrandsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrandsPage />
    </QueryClientProvider>,
  )
}

describe('BrandsPage (SimpleCatalogEntityPage)', () => {
  it('renders the list with real data', async () => {
    renderBrandsPage()

    expect(await screen.findByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Samsung')).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/brands`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(brands)
      }),
    )

    const { container } = renderBrandsPage()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(await screen.findByText('Apple')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/brands`, () => HttpResponse.json([])))
    renderBrandsPage()

    expect(await screen.findByText('No hay marcas todavía')).toBeInTheDocument()
    expect(screen.getByText('Crear el primero')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/brands`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderBrandsPage()

    expect(
      await screen.findByText('No se pudo cargar marcas'),
    ).toBeInTheDocument()
  })

  it('shows a scoped 403 state for this tab only', async () => {
    server.use(
      http.get(`${BASE_URL}/brands`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderBrandsPage()

    expect(
      await screen.findByText('No tienes permiso para ver marcas'),
    ).toBeInTheDocument()
  })

  it('rejects a too-short name client-side via Zod, without calling the API', async () => {
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByText('Nueva marca'))
    await user.type(screen.getByLabelText('Nombre'), 'A')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Debe tener al menos 2 caracteres.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('creates a brand and refetches the list to show it', async () => {
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByText('Nueva marca'))
    await user.type(screen.getByLabelText('Nombre'), 'Xiaomi')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByText('Guardar')).not.toBeInTheDocument())
    expect(await screen.findByText('Xiaomi')).toBeInTheDocument()
    expect(lastPostBody).toEqual({ name: 'Xiaomi' })
  })

  it('edits a brand and reflects the new name after refetch', async () => {
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByLabelText('Editar Apple'))
    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'Apple Inc.')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(lastPutBody).toEqual({ name: 'Apple Inc.' })
  })

  it('soft-deletes a brand after confirmation and it disappears from the list', async () => {
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByLabelText('Eliminar Apple'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(screen.queryByText('Apple')).not.toBeInTheDocument())
    expect(screen.getByText('Samsung')).toBeInTheDocument()
  })

  it('shows a 403 error inside the modal when creating without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/brands`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByText('Nueva marca'))
    await user.type(screen.getByLabelText('Nombre'), 'Xiaomi')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
    // Modal stays open on failure.
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate name, verbatim', async () => {
    const user = userEvent.setup()
    renderBrandsPage()

    await screen.findByText('Apple')
    await user.click(screen.getByText('Nueva marca'))
    await user.type(screen.getByLabelText('Nombre'), 'Apple')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Brand already exists.')).toBeInTheDocument()
  })
})
