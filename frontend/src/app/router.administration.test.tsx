import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

// Same lesson already applied in router.purchases.test.tsx (F9) and
// router.sales.test.tsx (F10): App.tsx's module-level QueryClient uses
// TanStack Query's default retry, so error responses take several
// seconds to settle here. This file only needs 200 responses to prove
// each route wires to the right component; 403/404/etc are covered in
// isolation in each page's own test file (with retry disabled there).
const server = setupServer(
  http.get(`${BASE_URL}/users`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/roles`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/permissions`, () => HttpResponse.json([])),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearTokens()
})
afterAll(() => server.close())

function renderAt(path: string) {
  setTokens('access-token', 'refresh-token')
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('AppRouter -- /administracion', () => {
  it('redirects /administracion to /administracion/usuarios', async () => {
    renderAt('/administracion')

    expect(
      await screen.findByText('No hay usuarios todavía'),
    ).toBeInTheDocument()
  })

  it('renders UsersPage at /administracion/usuarios', async () => {
    renderAt('/administracion/usuarios')

    expect(
      await screen.findByText('No hay usuarios todavía'),
    ).toBeInTheDocument()
  })

  it('renders RolesPage at /administracion/roles', async () => {
    renderAt('/administracion/roles')

    expect(
      await screen.findByText('No hay roles todavía'),
    ).toBeInTheDocument()
  })

  it('renders PermissionsPage at /administracion/permisos', async () => {
    renderAt('/administracion/permisos')

    expect(
      await screen.findByText(
        'No hay permisos que coincidan con la búsqueda',
      ),
    ).toBeInTheDocument()
  })

  it('exposes Administración as a real Sidebar link', async () => {
    renderAt('/administracion')

    await screen.findByText('No hay usuarios todavía')
    const adminLink = screen.getByRole('link', { name: 'Administración' })
    expect(adminLink).toHaveAttribute('href', '/administracion')

    // Reportes (F12) was the last placeholder; it is now a real link too,
    // so the Sidebar has no non-navigable buttons left to contrast against.
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })
    expect(reportsLink).toHaveAttribute('href', '/reportes')
  })

  it('marks the Administración link and Usuarios tab as active', async () => {
    renderAt('/administracion/usuarios')

    await screen.findByText('No hay usuarios todavía')
    const adminLink = screen.getByRole('link', { name: 'Administración' })

    await waitFor(() => expect(adminLink).toHaveClass('border-primary'))

    const usersTab = screen.getByRole('link', { name: 'Usuarios' })
    expect(usersTab).toHaveClass('border-primary')
  })
})
