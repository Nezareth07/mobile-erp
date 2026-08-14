import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const server = setupServer(
  http.get(`${BASE_URL}/customers`, () => HttpResponse.json([])),
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

describe('AppRouter -- /clientes', () => {
  it('renders CustomersPage at /clientes', async () => {
    renderAt('/clientes')

    expect(
      await screen.findByText('No hay clientes todavía'),
    ).toBeInTheDocument()
  })

  it('exposes Clientes as a real Sidebar link', async () => {
    renderAt('/clientes')

    await screen.findByText('No hay clientes todavía')
    const customersLink = screen.getByRole('link', { name: 'Clientes' })
    expect(customersLink).toHaveAttribute('href', '/clientes')

    // Reportes (F12) was the last placeholder; it is now a real link too,
    // so the Sidebar has no non-navigable buttons left to contrast against.
    const reportsLink = screen.getByRole('link', { name: 'Reportes' })
    expect(reportsLink).toHaveAttribute('href', '/reportes')
  })

  it('marks the Clientes link as active when on /clientes', async () => {
    renderAt('/clientes')

    await screen.findByText('No hay clientes todavía')
    const customersLink = screen.getByRole('link', { name: 'Clientes' })

    await waitFor(() =>
      expect(customersLink).toHaveClass('border-primary'),
    )
  })
})
