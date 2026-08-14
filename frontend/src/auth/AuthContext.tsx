import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import { clearTokens, getAccessToken, setTokens } from './authStorage'
import { decodeAccessTokenSubject } from './jwt'
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

  // The backend has no /users/me endpoint (confirmed during the F11 audit),
  // so the only client-side way to know the current user's id -- needed for
  // PUT /users/{id}/password -- is to read the `sub` claim already present
  // in the access token we already store. Signature/expiry are not verified
  // here; the backend still enforces both on every real request.
  const [userId, setUserId] = useState<string | null>(() => {
    const token = getAccessToken()
    return token ? decodeAccessTokenSubject(token) : null
  })

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens()
      setStatus('unauthenticated')
      setUserId(null)
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password })
    const { access_token, refresh_token } = response.data
    setTokens(access_token, refresh_token)
    setUserId(decodeAccessTokenSubject(access_token))
    setStatus('authenticated')
  }

  function logout() {
    clearTokens()
    setStatus('unauthenticated')
    setUserId(null)
  }

  return (
    <AuthContext.Provider value={{ status, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
