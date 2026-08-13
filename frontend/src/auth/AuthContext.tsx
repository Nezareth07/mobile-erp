import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import { clearTokens, getAccessToken, setTokens } from './authStorage'
import { AuthContext } from './authContextBase'
import type { AuthStatus } from './authContextBase'

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // localStorage is synchronous, so the initial session state is known
  // before first paint — computed via lazy initializer rather than an
  // effect. 'loading' stays part of AuthStatus for a future async session
  // check (e.g. a /users/me call) without changing ProtectedRoute's contract.
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAccessToken() ? 'authenticated' : 'unauthenticated',
  )

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens()
      setStatus('unauthenticated')
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password })
    const { access_token, refresh_token } = response.data
    setTokens(access_token, refresh_token)
    setStatus('authenticated')
  }

  function logout() {
    clearTokens()
    setStatus('unauthenticated')
  }

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
