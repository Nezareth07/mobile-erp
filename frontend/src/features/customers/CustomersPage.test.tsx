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
import { CustomersPage } from './CustomersPage'

const BASE_URL = 'http://localhost:8000/api/v1'

interface CustomerRecord {
  id: string
  name: string
  document_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  is_default_customer: boolean
  created_at: string
  updated_at: string
}

let customers: CustomerRecord[] = []
let postCallCount = 0
let lastPostBody: unknown = null
let lastPutBody: unknown = null

function resetData() {
  customers = [
    {
      id: 'customer-1',
      name: 'Juan Pérez',
      document_id: '12345678',
      phone: '555-1000',
      email: 'juan@example.com',
      address: 'Av. Central 123',
      notes: 'Cliente frecuente.',
      is_active: true,
      is_default_customer: false,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'customer-2',
      name: 'Consumidor Final',
      document_id: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
      is_active: true,
      is_default_customer: true,
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
    http.get(`${BASE_URL}/customers`, () => HttpResponse.json(customers)),
    http.post(`${BASE_URL}/customers`, async ({ request }) => {
      postCallCount += 1
      const body = (await request.json()) as {
        name: string
        document_id: string | null
      }
      lastPostBody = body

      if (
        body.document_id &&
        customers.some((customer) => customer.document_id === body.document_id)
      ) {
        return HttpResponse.json(
          { detail: 'Document ID already registered.' },
          { status: 409 },
        )
      }

      const created: CustomerRecord = {
        id: `customer-${customers.length + 1}`,
        name: body.name,
        document_id: body.document_id ?? null,
        phone: null,
        email: null,
        address: null,
        notes: null,
        is_active: true,
        is_default_customer: false,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      }
      customers = [...customers, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put(`${BASE_URL}/customers/:id`, async ({ request, params }) => {
      const body = (await request.json()) as Partial<CustomerRecord>
      lastPutBody = body
      customers = customers.map((customer) =>
        customer.id === params.id ? { ...customer, ...body } : customer,
      )
      const updated = customers.find((customer) => customer.id === params.id)
      return HttpResponse.json(updated)
    }),
    http.delete(`${BASE_URL}/customers/:id`, ({ params }) => {
      customers = customers.filter((customer) => customer.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(`${BASE_URL}/customers/:id/default`, ({ params }) => {
      customers = customers.map((customer) => ({
        ...customer,
        is_default_customer: customer.id === params.id,
      }))
      const updated = customers.find((customer) => customer.id === params.id)
      return HttpResponse.json(updated)
    }),
  ]
}

const server = setupServer(...defaultHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetData())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderCustomersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CustomersPage />
    </QueryClientProvider>,
  )
}

describe('CustomersPage', () => {
  it('renders the list with real data', async () => {
    renderCustomersPage()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument()
  })

  it('shows loading skeletons before data resolves', async () => {
    server.use(
      http.get(`${BASE_URL}/customers`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json(customers)
      }),
    )

    const { container } = renderCustomersPage()

    expect(
      container.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows an empty state with a create action when there is no data', async () => {
    server.use(http.get(`${BASE_URL}/customers`, () => HttpResponse.json([])))
    renderCustomersPage()

    expect(
      await screen.findByText('No hay clientes todavía'),
    ).toBeInTheDocument()
    expect(screen.getByText('Crear el primero')).toBeInTheDocument()
  })

  it('shows a generic error state on a non-403 failure', async () => {
    server.use(
      http.get(`${BASE_URL}/customers`, () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    renderCustomersPage()

    expect(
      await screen.findByText('No se pudieron cargar los clientes'),
    ).toBeInTheDocument()
  })

  it('shows a 403 empty state when listing without permission', async () => {
    server.use(
      http.get(`${BASE_URL}/customers`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    renderCustomersPage()

    expect(
      await screen.findByText('No tienes permiso para ver clientes'),
    ).toBeInTheDocument()
  })

  it('filters the list by name client-side', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.type(screen.getByLabelText('Buscar por nombre'), 'consumidor')

    expect(screen.getByText('Consumidor Final')).toBeInTheDocument()
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
  })

  it('rejects a too-short name client-side via Zod, without calling the API', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'A')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Debe tener al menos 2 caracteres.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('rejects a document_id longer than 20 characters client-side', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'Cliente Nuevo')
    await user.type(
      screen.getByLabelText('Documento de identidad'),
      '123456789012345678901',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('No puede superar 20 caracteres.'),
    ).toBeInTheDocument()
    expect(postCallCount).toBe(0)
  })

  it('creates a customer with only the required name and refetches the list', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'Cliente Nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(screen.queryByText('Guardar')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Cliente Nuevo')).toBeInTheDocument()
    expect(lastPostBody).toEqual({
      name: 'Cliente Nuevo',
      document_id: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
    })
  })

  it('accepts a plain string in email without format validation, matching the backend str | None contract', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'Cliente Email Raro')
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
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByLabelText('Editar Juan Pérez'))

    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan Pérez')
    expect(screen.getByLabelText('Documento de identidad')).toHaveValue(
      '12345678',
    )
    expect(screen.getByLabelText('Teléfono')).toHaveValue('555-1000')
    expect(screen.getByLabelText('Email')).toHaveValue('juan@example.com')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Central 123')
    expect(screen.getByLabelText('Notas')).toHaveValue('Cliente frecuente.')
  })

  it('edits only the name and preserves the other existing optional fields on save', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByLabelText('Editar Juan Pérez'))
    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'Juan Pérez Gómez')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Juan Pérez Gómez')).toBeInTheDocument()
    expect(lastPutBody).toEqual({
      name: 'Juan Pérez Gómez',
      document_id: '12345678',
      phone: '555-1000',
      email: 'juan@example.com',
      address: 'Av. Central 123',
      notes: 'Cliente frecuente.',
    })
  })

  it('soft-deletes a customer after confirmation and it disappears from the list', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByLabelText('Eliminar Juan Pérez'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Consumidor Final')).toBeInTheDocument()
  })

  it('shows a 403 error inside the modal when creating without permission', async () => {
    server.use(
      http.post(`${BASE_URL}/customers`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'Cliente Nuevo')
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
      http.delete(`${BASE_URL}/customers/:id`, () =>
        HttpResponse.json(
          { detail: 'You do not have permission to perform this action.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByLabelText('Eliminar Juan Pérez'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(
      await screen.findByText(
        'You do not have permission to perform this action.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('shows the real backend 409 message on a duplicate document_id, verbatim', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(screen.getByText('Nuevo cliente'))
    await user.type(screen.getByLabelText('Nombre'), 'Otro Cliente')
    await user.type(screen.getByLabelText('Documento de identidad'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Document ID already registered.'),
    ).toBeInTheDocument()
  })

  it('marks a customer as default and moves the "Por defecto" badge to the correct row', async () => {
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    expect(screen.getAllByText('Por defecto')).toHaveLength(1)

    await user.click(
      screen.getByLabelText('Marcar a Juan Pérez como cliente por defecto'),
    )

    await waitFor(() => expect(screen.getAllByText('Por defecto')).toHaveLength(1))
    const juanRow = screen.getByText('Juan Pérez').closest('tr')
    expect(juanRow).not.toBeNull()
    expect(juanRow!.textContent).toContain('Por defecto')
    const consumidorRow = screen.getByText('Consumidor Final').closest('tr')
    expect(consumidorRow!.textContent).not.toContain('Por defecto')
  })

  it('disables the default-customer action for the row that is already default', async () => {
    renderCustomersPage()

    await screen.findByText('Consumidor Final')
    expect(
      screen.getByLabelText('Consumidor Final ya es el cliente por defecto'),
    ).toBeDisabled()
  })

  it('shows a backend error when marking a customer as default fails', async () => {
    server.use(
      http.put(`${BASE_URL}/customers/:id/default`, () =>
        HttpResponse.json(
          { detail: 'Customer is not active.' },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderCustomersPage()

    await screen.findByText('Juan Pérez')
    await user.click(
      screen.getByLabelText('Marcar a Juan Pérez como cliente por defecto'),
    )

    expect(
      await screen.findByText('Customer is not active.'),
    ).toBeInTheDocument()
  })
})
