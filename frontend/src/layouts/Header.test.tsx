import { createRef } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../auth/AuthContext'
import { setTokens } from '../auth/authStorage'
import { Header } from './Header'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderHeader() {
  setTokens('access-token', 'refresh-token')
  const ref = createRef<HTMLButtonElement>()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Header
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenMobileMenu={() => {}}
          mobileMenuTriggerRef={ref}
        />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Header -- change password access', () => {
  it('opens the change password dialog from the account area', async () => {
    const user = userEvent.setup()
    renderHeader()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Cambiar contraseña' }),
    ).toBeInTheDocument()
  })
})
