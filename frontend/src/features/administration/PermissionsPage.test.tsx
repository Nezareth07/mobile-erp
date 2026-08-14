import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { PermissionsPage } from './PermissionsPage'

const BASE_URL = 'http://localhost:8000/api/v1'

function permission(
  code: string,
  description: string,
  id = code,
) {
  return { id, code, description, created_at: '2026-01-01T00:00:00Z' }
}

const permissions = [
  permission('brands.read', 'Read brands'),
  permission('brands.create', 'Create brands'),
  permission('sales.create', 'Register sales'),
  permission('sales.read', 'Read sales'),
]

const server = setupServer(
  http.get(`${BASE_URL}/permissions`, () => HttpResponse.json(permissions)),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPermissionsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PermissionsPage />
    </QueryClientProvider>,
  )
}

describe('PermissionsPage', () => {
  it('renders the real 29-permission catalog grouped by module, showing code and description', async () => {
    renderPermissionsPage()

    const brandsGroup = (await screen.findByText('brands')).closest('div')
    expect(brandsGroup).not.toBeNull()
    expect(within(brandsGroup as HTMLElement).getByText('brands.read')).toBeInTheDocument()
    expect(within(brandsGroup as HTMLElement).getByText('Read brands')).toBeInTheDocument()
    expect(within(brandsGroup as HTMLElement).getByText('brands.create')).toBeInTheDocument()

    const salesGroup = screen.getByText('sales').closest('div')
    expect(
      within(salesGroup as HTMLElement).getByText('sales.create'),
    ).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/permissions`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(permissions)
      }),
    )

    const { container } = renderPermissionsPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('brands.read')).toBeInTheDocument()
  })

  it('shows an empty state when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/permissions`, () => HttpResponse.json([])))
    renderPermissionsPage()

    expect(
      await screen.findByText('No hay permisos que coincidan con la búsqueda'),
    ).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/permissions`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderPermissionsPage()

    expect(
      await screen.findByText('No se pudieron cargar los permisos'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/permissions`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderPermissionsPage()

    expect(
      await screen.findByText('No tienes permiso para ver permisos'),
    ).toBeInTheDocument()
  })

  it('filters by code or description client-side', async () => {
    const user = userEvent.setup()
    renderPermissionsPage()

    await screen.findByText('brands.read')
    await user.type(
      screen.getByLabelText('Buscar por código o descripción'),
      'Register sales',
    )

    expect(screen.queryByText('brands.read')).not.toBeInTheDocument()
    expect(screen.getByText('sales.create')).toBeInTheDocument()
  })
})
