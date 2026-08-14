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
import { UsersPage } from './UsersPage'

const BASE_URL = 'http://localhost:8000/api/v1'

const roleAdmin = {
  id: 'role-admin',
  name: 'ADMIN',
  description: 'Acceso total',
  is_active: true,
  permissions: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const roleVendor = {
  id: 'role-vendor',
  name: 'VENDEDOR',
  description: null,
  is_active: true,
  permissions: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'juan@mobileerp.dev',
    full_name: 'Juan Pérez',
    is_active: true,
    roles: [{ id: 'role-admin', name: 'ADMIN' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

let users: unknown[] = []
let roles: unknown[] = []
let lastRolesAssignmentBody: { role_ids: string[] } | null = null

function resetData() {
  users = [buildUser()]
  roles = [roleAdmin, roleVendor]
  lastRolesAssignmentBody = null
}

function defaultHandlers() {
  return [
    http.get(`${BASE_URL}/users`, () => HttpResponse.json(users)),
    http.get(`${BASE_URL}/users/:id`, ({ params }) => {
      const found = (users as { id: string }[]).find(
        (candidate) => candidate.id === params.id,
      )
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ detail: 'User not found.' }, { status: 404 })
    }),
    http.get(`${BASE_URL}/roles`, () => HttpResponse.json(roles)),
    http.post(`${BASE_URL}/users`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const created = buildUser({
        id: 'user-new',
        email: body.email,
        full_name: body.full_name,
        roles: [],
      })
      users = [...users, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/users/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const existing = (users as { id: string }[]).find(
        (candidate) => candidate.id === params.id,
      )
      const updated = buildUser({ ...existing, id: params.id, ...body })
      users = users.map((candidate) =>
        (candidate as { id: string }).id === params.id ? updated : candidate,
      )
      return HttpResponse.json(updated)
    }),
    http.delete(`${BASE_URL}/users/:id`, () =>
      HttpResponse.json(null, { status: 204 }),
    ),
    http.put(
      `${BASE_URL}/users/:id/roles`,
      async ({ params, request }) => {
        const body = (await request.json()) as { role_ids: string[] }
        lastRolesAssignmentBody = body
        const assignedRoles = roles.filter((role) =>
          body.role_ids.includes((role as { id: string }).id),
        )
        return HttpResponse.json(
          buildUser({
            id: params.id,
            roles: assignedRoles.map((role) => ({
              id: (role as { id: string }).id,
              name: (role as { name: string }).name,
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

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

describe('UsersPage', () => {
  it('renders the list with real data', async () => {
    renderUsersPage()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('juan@mobileerp.dev')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/users`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(users)
      }),
    )

    const { container } = renderUsersPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/users`, () => HttpResponse.json([])))
    renderUsersPage()

    expect(
      await screen.findByText('No hay usuarios todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Crear el primero')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/users`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderUsersPage()

    expect(
      await screen.findByText('No se pudieron cargar los usuarios'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/users`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderUsersPage()

    expect(
      await screen.findByText('No tienes permiso para ver usuarios'),
    ).toBeInTheDocument()
  })

  it('filters the list by name or email client-side', async () => {
    users = [
      buildUser({ id: 'user-1', full_name: 'Juan Pérez', email: 'juan@x.dev' }),
      buildUser({ id: 'user-2', full_name: 'Ana Gómez', email: 'ana@x.dev' }),
    ]
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.type(
      screen.getByLabelText('Buscar por nombre o email'),
      'ana',
    )

    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
  })

  it('creates a user with the real field set and refetches the list', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await user.type(screen.getByLabelText('Email'), 'nuevo@mobileerp.dev')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Usuario')
    await user.type(screen.getByLabelText('Contraseña'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Nuevo Usuario')).toBeInTheDocument()
  })

  it('rejects an invalid email and a too-short password client-side, without calling the API', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Nombre completo'), 'Alguien')
    await user.type(screen.getByLabelText('Contraseña'), 'short')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Ingresa un email válido.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Debe tener al menos 8 caracteres.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate email, verbatim', async () => {
    server.use(
      http.post(`${BASE_URL}/users`, () =>
        HttpResponse.json(
          { detail: 'Email already registered.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    await user.type(screen.getByLabelText('Email'), 'juan@mobileerp.dev')
    await user.type(screen.getByLabelText('Nombre completo'), 'Otro Juan')
    await user.type(screen.getByLabelText('Contraseña'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Email already registered.'),
    ).toBeInTheDocument()
  })

  it('edits only email/full_name (no password or roles fields shown)', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: 'Editar Juan Pérez' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(
      screen.getByText('La contraseña y los roles se gestionan por separado.'),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre completo'))
    await user.type(screen.getByLabelText('Nombre completo'), 'Juan P. Editado')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Juan P. Editado')).toBeInTheDocument()
  })

  it('opens the assign-roles dialog with the current roles preselected', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Asignar roles a Juan Pérez' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar roles a Juan Pérez',
    })
    const adminCheckbox = within(dialog).getByLabelText('ADMIN')
    const vendorCheckbox = within(dialog).getByLabelText('VENDEDOR')

    await waitFor(() => expect(adminCheckbox).toBeChecked())
    expect(vendorCheckbox).not.toBeChecked()
  })

  it('disables Save while current role assignments are still loading, and never shows an empty checklist', async () => {
    server.use(
      http.get(`${BASE_URL}/users/:id`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(buildUser())
      }),
    )
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Asignar roles a Juan Pérez' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar roles a Juan Pérez',
    })
    expect(within(dialog).queryByLabelText('ADMIN')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await waitFor(() =>
      expect(within(dialog).getByLabelText('ADMIN')).toBeChecked(),
    )
  })

  it('does not allow submit when loading the current role assignments fails', async () => {
    server.use(
      http.get(`${BASE_URL}/users/:id`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Asignar roles a Juan Pérez' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar roles a Juan Pérez',
    })
    expect(
      await within(dialog).findByText(
        'No se pudieron cargar los roles actuales. Cierra e intenta de nuevo.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('sends the full replaced role set (not just the delta) when assigning roles', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Asignar roles a Juan Pérez' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Asignar roles a Juan Pérez',
    })
    await waitFor(() =>
      expect(within(dialog).getByLabelText('ADMIN')).toBeChecked(),
    )

    await user.click(within(dialog).getByLabelText('VENDEDOR'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(lastRolesAssignmentBody).not.toBeNull())
    expect(lastRolesAssignmentBody!.role_ids.sort()).toEqual(
      ['role-admin', 'role-vendor'].sort(),
    )
  })

  it('deactivates a user after confirmation, with an explicit irreversibility warning', async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Desactivar Juan Pérez' }),
    )

    expect(
      await screen.findByText(
        /Esta acción no se puede deshacer desde la aplicación\./,
      ),
    ).toBeInTheDocument()

    server.use(http.get(`${BASE_URL}/users`, () => HttpResponse.json([])))
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(
      await screen.findByText('No hay usuarios todavía'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 400 message when deactivating the last active ADMIN, verbatim', async () => {
    server.use(
      http.delete(`${BASE_URL}/users/:id`, () =>
        HttpResponse.json(
          {
            detail:
              'This operation would leave the system without any active ADMIN user.',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderUsersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByRole('button', { name: 'Desactivar Juan Pérez' }),
    )
    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(
      await screen.findByText(
        'This operation would leave the system without any active ADMIN user.',
      ),
    ).toBeInTheDocument()
  })
})
