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
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { CategoriesPage } from './CategoriesPage'

const BASE_URL = 'http://localhost:8000/api/v1'

interface CategoryRecord {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

let categories: CategoryRecord[] = []

function resetData() {
  categories = [
    {
      id: 'cat-1',
      name: 'Smartphones',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ]
}

// Deliberately lighter than BrandsPage.test.tsx: BrandsPage already
// exercises SimpleCatalogEntityPage's full behavior (loading/empty/error/
// 403/create/edit/delete/409). This file's only job is to prove the same
// generic component works correctly with Category's own labels, copy and
// endpoint -- not to re-test the shared behavior a second time.
function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/categories`, () => HttpResponse.json(categories)),
    http.post(`${BASE_URL}/categories`, async ({ request }) => {
      const body = (await request.json()) as { name: string }
      const created: CategoryRecord = {
        id: 'cat-2',
        name: body.name,
        is_active: true,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      }
      categories = [...categories, created]
      return HttpResponse.json(created, { status: 201 })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderCategoriesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CategoriesPage />
    </QueryClientProvider>,
  )
}

describe('CategoriesPage (SimpleCatalogEntityPage, generic reuse)', () => {
  it('renders with Category-specific copy and real data', async () => {
    renderCategoriesPage()

    expect(await screen.findByText('Smartphones')).toBeInTheDocument()
    expect(screen.getByText('Nueva categoría')).toBeInTheDocument()
  })

  it('shows the Category-specific empty state', async () => {
    server.use(http.get(`${BASE_URL}/categories`, () => HttpResponse.json([])))
    renderCategoriesPage()

    expect(
      await screen.findByText('No hay categorías todavía'),
    ).toBeInTheDocument()
  })

  it('creates a category through the same generic form and refetches the list', async () => {
    const user = userEvent.setup()
    renderCategoriesPage()

    await screen.findByText('Smartphones')
    await user.click(screen.getByText('Nueva categoría'))
    await user.type(screen.getByLabelText('Nombre'), 'Accesorios')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Accesorios')).toBeInTheDocument()
  })
})
