import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth/AuthContext'
import { clearTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

const server = setupServer(
  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }

    if (body.password === 'correct-password') {
      return HttpResponse.json({
        access_token: 'session-access-token',
        refresh_token: 'session-refresh-token',
        token_type: 'bearer',
        expires_in: 1800,
      })
    }

    return HttpResponse.json(
      { detail: 'Invalid email or password.' },
      { status: 401 },
    )
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  clearTokens()
})
afterAll(() => server.close())

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>protected home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  it('logs in with valid credentials and navigates to the protected area', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(
      screen.getByLabelText(/correo electrónico/i),
      'user@mobileerp.dev',
    )
    await user.type(screen.getByLabelText(/contraseña/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() =>
      expect(screen.getByText('protected home')).toBeInTheDocument(),
    )
  })

  it('shows the backend error message on invalid credentials without navigating', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(
      screen.getByLabelText(/correo electrónico/i),
      'user@mobileerp.dev',
    )
    await user.type(screen.getByLabelText(/contraseña/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(
      await screen.findByText('Invalid email or password.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('protected home')).not.toBeInTheDocument()
  })
})
