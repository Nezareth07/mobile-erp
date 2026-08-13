import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/feedback/EmptyState'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <EmptyState
        title="Página no encontrada"
        description="La ruta que buscas no existe."
        action={
          <Link to="/">
            <Button size="sm">Volver al inicio</Button>
          </Link>
        }
      />
    </div>
  )
}
