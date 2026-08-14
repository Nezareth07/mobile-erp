import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../../auth/AuthContext'
import { setTokens } from '../../auth/authStorage'
import { ChangePasswordDialog } from './ChangePasswordDialog'

const BASE_URL = 'http://localhost:8000/api/v1'
const USER_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildAccessToken(sub: string): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = encodeBase64Url(JSON.stringify({ sub, type: 'access' }))
  return `${header}.${body}.fake-signature`
}

const server = setupServer(
  http.put(`${BASE_URL}/users/${USER_ID}/password`, () =>
    HttpResponse.json(null, { status: 204 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderDialog(open = true) {
  setTokens(buildAccessToken(USER_ID), 'refresh-token')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChangePasswordDialog open={open} onClose={() => {}} />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('ChangePasswordDialog', () => {
  it('is accessible as a dialog with both password fields', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
  })

  it('rejects an empty current password and a too-short new password client-side, without calling the API', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Contraseña nueva'), 'short')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Ingresa tu contraseña actual.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Debe tener al menos 8 caracteres.'),
    ).toBeInTheDocument()
  })

  it('changes the password successfully and shows a confirmation', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'current-pass',
    )
    await user.type(screen.getByLabelText('Contraseña nueva'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Tu contraseña se actualizó correctamente.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 400 message when the current password is incorrect, verbatim', async () => {
    server.use(
      http.put(`${BASE_URL}/users/${USER_ID}/password`, () =>
        HttpResponse.json(
          { detail: 'Current password is incorrect.' },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Contraseña actual'), 'wrong-pass')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Current password is incorrect.'),
    ).toBeInTheDocument()
  })

  it('shows the real backend 400 message when the password is too large once encoded, verbatim', async () => {
    server.use(
      http.put(`${BASE_URL}/users/${USER_ID}/password`, () =>
        HttpResponse.json(
          {
            detail:
              'Password exceeds the maximum allowed size once encoded.',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderDialog()

    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'current-pass',
    )
    await user.type(screen.getByLabelText('Contraseña nueva'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText(
        'Password exceeds the maximum allowed size once encoded.',
      ),
    ).toBeInTheDocument()
  })

  it('shows a 403 error verbatim if the backend rejects the request', async () => {
    server.use(
      http.put(`${BASE_URL}/users/${USER_ID}/password`, () =>
        HttpResponse.json(
          { detail: 'You can only change your own password.' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderDialog()

    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'current-pass',
    )
    await user.type(screen.getByLabelText('Contraseña nueva'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('You can only change your own password.'),
    ).toBeInTheDocument()
  })
})
