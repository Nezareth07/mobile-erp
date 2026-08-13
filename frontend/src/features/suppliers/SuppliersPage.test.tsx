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
import { SuppliersPage } from './SuppliersPage'

const BASE_URL = 'http://localhost:8000/api/v1'

interface SupplierRecord {
  id: string
  name: string
  tax_id: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

let suppliers: SupplierRecord[] = []
let postCallCount = 0
let lastPostBody: unknown = null
let lastPutBody: unknown = null

function resetData() {
  suppliers = [
    {
      id: 'supplier-1',
      name: 'TechImport S.A.',
      tax_id: '20123456789',
      contact_name: 'Ana Rojas',
      phone: '555-1000',
      email: 'ana@techimport.com',
      address: 'Av. Central 123',
      notes: 'Proveedor principal de smartphones.',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'supplier-2',
      name: 'Accesorios del Sur',
      tax_id: null,
      contact_name: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
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
    http.get(`${BASE_URL}/suppliers`, () => HttpResponse.json(suppliers)),
    http.post(`${BASE_URL}/suppliers`, async ({ request }) => {
      postCallCount += 1
      const body = (await request.json()) as {
        name: string
        tax_id: string | null
      }
      lastPostBody = body

      if (suppliers.some((supplier) => supplier.name === body.name)) {
        return HttpResponse.json(
          { detail: 'Supplier already exists.' },
          { status: 409 },
        )
      }

      if (
        body.tax_id &&
        suppliers.some((supplier) => supplier.tax_id === body.tax_id)
      ) {
        return HttpResponse.json(
          { detail: 'Tax ID already registered.' },
          { status: 409 },
        )
      }

      const created: SupplierRecord = {
        id: `supplier-${suppliers.length + 1}`,
        name: body.name,
        tax_id: body.tax_id ?? null,
        contact_name: null,
        phone: null,
        email: null,
        address: null,
        notes: null,
        is_active: true,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      }
      suppliers = [...suppliers, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/suppliers/:id`, async ({ request, params }) => {
      const body = (await request.json()) as Partial<SupplierRecord>
      lastPutBody = body
      suppliers = suppliers.map((supplier) =>
        supplier.id === params.id ? { ...supplier, ...body } : supplier,
      )
      const updated = suppliers.find((supplier) => supplier.id === params.id)
      return HttpResponse.json(updated)
    }),
    http.delete(`${BASE_URL}/suppliers/:id`, ({ params }) => {
      suppliers = suppliers.filter((supplier) => supplier.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderSuppliersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SuppliersPage />
    </QueryClientProvider>,
  )
}

describe('SuppliersPage', () => {
  it('renders the list with real data', async () => {
    renderSuppliersPage()

    expect(await screen.findByText('TechImport S.A.')).toBeInTheDocument()
    expect(screen.getByText('Accesorios del Sur')).toBeInTheDocument()
    expect(screen.getByText('Ana Rojas')).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/suppliers`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(suppliers)
      }),
    )

    const { container } = renderSuppliersPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('TechImport S.A.')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/suppliers`, () => HttpResponse.json([])))
    renderSuppliersPage()

    expect(
      await screen.findByText('No hay proveedores todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Crear el primero')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/suppliers`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderSuppliersPage()

    expect(
      await screen.findByText('No se pudieron cargar los proveedores'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/suppliers`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderSuppliersPage()

    expect(
      await screen.findByText('No tienes permiso para ver proveedores'),
    ).toBeInTheDocument()
  })

  it('filters the list by name client-side', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.type(screen.getByLabelText('Buscar por nombre'), 'accesorios')

    expect(screen.getByText('Accesorios del Sur')).toBeInTheDocument()
    expect(screen.queryByText('TechImport S.A.')).not.toBeInTheDocument()
  })

  it('rejects a too-short name client-side via Zod, without calling the API', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'A')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Debe tener al menos 2 caracteres.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('rejects a tax_id longer than 20 characters client-side', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'Proveedor Nuevo')
    await user.type(
      screen.getByLabelText('RUC / Tax ID'),
      '123456789012345678901',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('No puede superar 20 caracteres.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('creates a supplier with only the required name and refetches the list', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'Proveedor Nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(screen.queryByText('Guardar')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Proveedor Nuevo')).toBeInTheDocument()
    expect(lastPostBody).toEqual({
      name: 'Proveedor Nuevo',
      tax_id: null,
      contact_name: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
    })
  })

  it('accepts a plain string in email without format validation, matching the backend str | None contract', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'Proveedor Email Raro')
    await user.type(screen.getByLabelText('Email'), 'no-es-un-email')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(screen.queryByText('Guardar')).not.toBeInTheDocument(),
    )
    expect(lastPostBody).toEqual(
      expect.objectContaining({ email: 'no-es-un-email' }),
    )
  })

  it('opens the edit modal pre-filled with all existing optional fields', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByLabelText('Editar TechImport S.A.'))

    expect(screen.getByLabelText('Nombre')).toHaveValue('TechImport S.A.')
    expect(screen.getByLabelText('RUC / Tax ID')).toHaveValue('20123456789')
    expect(screen.getByLabelText('Persona de contacto')).toHaveValue(
      'Ana Rojas',
    )
    expect(screen.getByLabelText('Teléfono')).toHaveValue('555-1000')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@techimport.com')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Central 123')
    expect(screen.getByLabelText('Notas')).toHaveValue(
      'Proveedor principal de smartphones.',
    )
  })

  it('edits only the name and preserves the other existing optional fields on save', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByLabelText('Editar TechImport S.A.'))
    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'TechImport SAC')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('TechImport SAC')).toBeInTheDocument()
    expect(lastPutBody).toEqual({
      name: 'TechImport SAC',
      tax_id: '20123456789',
      contact_name: 'Ana Rojas',
      phone: '555-1000',
      email: 'ana@techimport.com',
      address: 'Av. Central 123',
      notes: 'Proveedor principal de smartphones.',
    })
  })

  it('soft-deletes a supplier after confirmation and it disappears from the list', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByLabelText('Eliminar TechImport S.A.'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(screen.queryByText('TechImport S.A.')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Accesorios del Sur')).toBeInTheDocument()
  })

  it('shows a 403 error inside the modal when creating without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/suppliers`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'Proveedor Nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('shows a 403 error inside the dialog when deleting without permission', async () => {
    server.use(
      http.delete(`${BASE_URL}/suppliers/:id`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByLabelText('Eliminar TechImport S.A.'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('TechImport S.A.')).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate name, verbatim', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'TechImport S.A.')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Supplier already exists.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate tax_id, verbatim', async () => {
    const user = userEvent.setup()
    renderSuppliersPage()

    await screen.findByText('TechImport S.A.')
    await user.click(screen.getByText('Nuevo proveedor'))
    await user.type(screen.getByLabelText('Nombre'), 'Otro Proveedor')
    await user.type(screen.getByLabelText('RUC / Tax ID'), '20123456789')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Tax ID already registered.'),
    ).toBeInTheDocument()
  })
})
