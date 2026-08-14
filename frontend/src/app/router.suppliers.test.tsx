import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const server = setupServer(
  http.get(`${BASE_URL}/suppliers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/brands`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/categories`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/products`, () => HttpResponse.json([])),
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

describe('AppRouter -- /proveedores', () => {
  it('renders SuppliersPage at /proveedores', async () => {
    renderAt('/proveedores')

    expect(
      await screen.findByText('No hay proveedores todavía'),
    ).toBeInTheDocument()
  })

  it('exposes Proveedores as a real Sidebar link, distinct from the placeholder buttons', async () => {
    renderAt('/proveedores')

    await screen.findByText('No hay proveedores todavía')
    const suppliersLink = screen.getByRole('link', { name: 'Proveedores' })
    expect(suppliersLink).toHaveAttribute('href', '/proveedores')

    // Clientes was a placeholder when this test was written (F6); F8 wired
    // it to a real route, so it is no longer a valid example here.
    expect(
      screen.queryByRole('link', { name: 'Ventas' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ventas' })).toBeInTheDocument()
  })

  it('marks the Proveedores link as active when on /proveedores', async () => {
    renderAt('/proveedores')

    await screen.findByText('No hay proveedores todavía')
    const suppliersLink = screen.getByRole('link', { name: 'Proveedores' })

    await waitFor(() =>
      expect(suppliersLink).toHaveClass('border-primary'),
    )
  })
})
