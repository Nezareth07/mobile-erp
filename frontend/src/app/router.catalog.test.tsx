import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../App'
import { clearTokens, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const server = setupServer(
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

describe('AppRouter -- /catalogo', () => {
  it('redirects /catalogo to /catalogo/productos', async () => {
    renderAt('/catalogo')

    await waitFor(() => {
      expect(screen.getByText('No hay productos todavía')).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/catalogo/productos')
  })

  it('renders ProductsPage at /catalogo/productos', async () => {
    renderAt('/catalogo/productos')

    expect(
      await screen.findByText('No hay productos todavía'),
    ).toBeInTheDocument()
  })

  it('renders BrandsPage at /catalogo/marcas', async () => {
    renderAt('/catalogo/marcas')

    expect(await screen.findByText('No hay marcas todavía')).toBeInTheDocument()
  })

  it('renders CategoriesPage at /catalogo/categorias', async () => {
    renderAt('/catalogo/categorias')

    expect(
      await screen.findByText('No hay categorías todavía'),
    ).toBeInTheDocument()
  })

  it('exposes Catálogo as a real Sidebar link, distinct from the placeholder buttons', async () => {
    renderAt('/catalogo/productos')

    await screen.findByText('No hay productos todavía')
    const catalogLink = screen.getByRole('link', { name: 'Catálogo' })
    expect(catalogLink).toHaveAttribute('href', '/catalogo')

    // Placeholder items (e.g. Inventario) are still plain buttons, not links.
    expect(
      screen.queryByRole('link', { name: 'Inventario' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inventario' })).toBeInTheDocument()
  })
})
