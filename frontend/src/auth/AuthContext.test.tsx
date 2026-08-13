import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'
import { clearTokens, getAccessToken, setTokens } from './authStorage'

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

function Probe() {
  const { status, login, logout } = useAuth()

  return (
    <div>
      <span data-testid="status">{status}</span>
      <button
        onClick={() => {
          login('user@mobileerp.dev', 'correct-password').catch(() => {})
        }}
      >
        login-ok
      </button>
      <button
        onClick={() => {
          login('user@mobileerp.dev', 'wrong-password').catch(() => {})
        }}
      >
        login-fail
      </button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  it('starts unauthenticated when no token is stored', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(
        'unauthenticated',
      ),
    )
  })

  it('starts authenticated when a token is already stored', async () => {
    setTokens('existing-access-token', 'existing-refresh-token')

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )
  })

  it('login() stores tokens and flips status to authenticated', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await user.click(screen.getByText('login-ok'))

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )
    expect(getAccessToken()).toBe('session-access-token')
  })

  it('login() with invalid credentials leaves status unauthenticated', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await user.click(screen.getByText('login-fail'))

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(
        'unauthenticated',
      ),
    )
    expect(getAccessToken()).toBeNull()
  })

  it('logout() clears tokens and flips status to unauthenticated', async () => {
    setTokens('existing-access-token', 'existing-refresh-token')
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )

    await user.click(screen.getByText('logout'))

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(getAccessToken()).toBeNull()
  })
})
