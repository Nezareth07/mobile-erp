import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { RolesPage } from './RolesPage'

const BASE_URL = 'http://localhost:8000/api/v1'

const permissionBrandsRead = {
  id: 'perm-brands-read',
  code: 'brands.read',
  description: 'Read brands',
  created_at: '2026-01-01T00:00:00Z',
}

const permissionBrandsCreate = {
  id: 'perm-brands-create',
  code: 'brands.create',
  description: 'Create brands',
  created_at: '2026-01-01T00:00:00Z',
}

function buildRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: 'VENDEDOR',
    description: 'Rol de ventas',
    is_active: true,
    permissions: [
      { id: 'perm-brands-read', code: 'brands.read' },
    ],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

let roles: unknown[] = []
let permissions: unknown[] = []
let lastPermissionsAssignmentBody: { permission_ids: string[] } | null = null

function resetData() {
  roles = [buildRole()]
  permissions = [permissionBrandsRead, permissionBrandsCreate]
  lastPermissionsAssignmentBody = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/roles`, () => HttpResponse.json(roles)),
    http.get(`${BASE_URL}/roles/:id`, ({ params }) => {
      const found = (roles as { id: string }[]).find(
        (candidate) => candidate.id === params.id,
      )
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ detail: 'Role not found.' }, { status: 404 })
    }),
    http.get(`${BASE_URL}/permissions`, () => HttpResponse.json(permissions)),
    http.post(`${BASE_URL}/roles`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const created = buildRole({
        id: 'role-new',
        name: body.name,
        description: body.description,
        permissions: [],
      })
      roles = [...roles, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/roles/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const existing = (roles as { id: string }[]).find(
        (candidate) => candidate.id === params.id,
      )
      const updated = buildRole({ ...existing, id: params.id, ...body })
      roles = roles.map((candidate) =>
        (candidate as { id: string }).id === params.id ? updated : candidate,
      )
      return HttpResponse.json(updated)
    }),
    http.delete(`${BASE_URL}/roles/:id`, () =>
      HttpResponse.json(null, { status: 204 }),
    ),
    http.put(
      `${BASE_URL}/roles/:id/permissions`,
      async ({ params, request }) => {
        const body = (await request.json()) as { permission_ids: string[] }
        lastPermissionsAssignmentBody = body
        const assigned = permissions.filter((permission) =>
          body.permission_ids.includes((permission as { id: string }).id),
        )
        return HttpResponse.json(
          buildRole({
            id: params.id,
            permissions: assigned.map((permission) => ({
              id: (permission as { id: string }).id,
              code: (permission as { code: string }).code,
            })),
          }),
        )
      },
    ),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderRolesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RolesPage />
    </QueryClientProvider>,
  )
}

describe('RolesPage', () => {
  it('renders the list with real data', async () => {
    renderRolesPage()

    expect(await screen.findByText('VENDEDOR')).toBeInTheDocument()
    expect(screen.getByText('Rol de ventas')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/roles`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(roles)
      }),
    )

    const { container } = renderRolesPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('VENDEDOR')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/roles`, () => HttpResponse.json([])))
    renderRolesPage()

    expect(
      await screen.findByText('No hay roles todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Crear el primero')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/roles`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderRolesPage()

    expect(
      await screen.findByText('No se pudieron cargar los roles'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/roles`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderRolesPage()

    expect(
      await screen.findByText('No tienes permiso para ver roles'),
    ).toBeInTheDocument()
  })

  it('creates a role with the real field set and refetches the list', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Nombre'), 'SOPORTE')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('SOPORTE')).toBeInTheDocument()
  })

  it('edits a role and reflects the change after refetch', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(screen.getByRole('button', { name: 'Editar VENDEDOR' }))
    await user.clear(screen.getByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'VENTAS')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('VENTAS')).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate role name, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/roles`, () =>
        HttpResponse.json(
          { detail: 'Role already exists.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Nombre'), 'VENDEDOR')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Role already exists.'),
    ).toBeInTheDocument()
  })

  it('opens the assign-permissions dialog with the current permissions preselected, grouped by module', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Asignar permisos a VENDEDOR' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar permisos a VENDEDOR',
    })
    expect(within(dialog).getByText('brands')).toBeInTheDocument()

    const readCheckbox = within(dialog).getByLabelText('brands.read')
    const createCheckbox = within(dialog).getByLabelText('brands.create')

    await waitFor(() => expect(readCheckbox).toBeChecked())
    expect(createCheckbox).not.toBeChecked()
  })

  it('disables Save while current permission assignments are still loading, and never shows an empty checklist', async () => {
    server.use(
      http.get(`${BASE_URL}/roles/:id`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(buildRole())
      }),
    )
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Asignar permisos a VENDEDOR' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar permisos a VENDEDOR',
    })
    expect(
      within(dialog).queryByLabelText('brands.read'),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await waitFor(() =>
      expect(within(dialog).getByLabelText('brands.read')).toBeChecked(),
    )
  })

  it('does not allow submit when loading the current permission assignments fails', async () => {
    server.use(
      http.get(`${BASE_URL}/roles/:id`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Asignar permisos a VENDEDOR' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar permisos a VENDEDOR',
    })
    expect(
      await within(dialog).findByText(
        'No se pudieron cargar los permisos actuales. Cierra e intenta de nuevo.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('sends the full replaced permission set (not just the delta) when assigning permissions', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Asignar permisos a VENDEDOR' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar permisos a VENDEDOR',
    })
    await waitFor(() =>
      expect(within(dialog).getByLabelText('brands.read')).toBeChecked(),
    )

    await user.click(within(dialog).getByLabelText('brands.create'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(lastPermissionsAssignmentBody).not.toBeNull())
    expect(lastPermissionsAssignmentBody!.permission_ids.sort()).toEqual(
      ['perm-brands-create', 'perm-brands-read'].sort(),
    )
  })

  it('deactivates a role after confirmation, with an explicit irreversibility warning', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Desactivar VENDEDOR' }),
    )

    expect(
      await screen.findByText(
        /Esta acción no se puede deshacer desde la aplicación\./,
      ),
    ).toBeInTheDocument()

    server.use(http.get(`${BASE_URL}/roles`, () => HttpResponse.json([])))
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(
      await screen.findByText('No hay roles todavía'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 400 message when the role still has active users assigned, verbatim', async () => {
    server.use(
      http.delete(`${BASE_URL}/roles/:id`, () =>
        HttpResponse.json(
          {
            detail:
              'Cannot deactivate a role that has active users assigned.',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRolesPage()

    await screen.findByText('VENDEDOR')
    await user.click(
      screen.getByRole('button', { name: 'Desactivar VENDEDOR' }),
    )
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(
      await screen.findByText(
        'Cannot deactivate a role that has active users assigned.',
      ),
    ).toBeInTheDocument()
  })
})
