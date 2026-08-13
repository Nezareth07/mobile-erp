import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from './useAuth'

export interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner size="lg" label="Verificando sesión" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
