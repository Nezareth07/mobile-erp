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

  it('exposes Proveedores as a real Sidebar link', async () => {
    renderAt('/proveedores')

    await screen.findByText('No hay proveedores todavía')
    const suppliersLink = screen.getByRole('link', { name: 'Proveedores' })
    expect(suppliersLink).toHaveAttribute('href', '/proveedores')

    // Reportes (F12) was the last placeholder; it is now a real link too,
    // so the Sidebar has no non-navigable buttons left to contrast against.
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })
    expect(reportsLink).toHaveAttribute('href', '/reportes')
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
