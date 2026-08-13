import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from './useAuth'
import type { AuthContextValue, AuthStatus } from './authContextBase'

vi.mock('./useAuth')

const mockedUseAuth = vi.mocked(useAuth)

function renderWithStatus(status: AuthStatus) {
  mockedUseAuth.mockReturnValue({
    status,
    login: vi.fn(),
    logout: vi.fn(),
  } satisfies AuthContextValue)

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows a spinner while status is loading', () => {
    renderWithStatus('loading')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    renderWithStatus('unauthenticated')

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    renderWithStatus('authenticated')

    expect(screen.getByText('protected content')).toBeInTheDocument()
  })
})
