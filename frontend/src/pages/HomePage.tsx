import { Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/feedback/EmptyState'

export function HomePage() {
  return (
    <>
      <PageHeader
        title="Application Shell"
        description="F2 — vitrina de design tokens y componentes base. Sin datos ni llamadas reales al backend."
        actions={
          <Button size="sm">
            <Plus size={16} aria-hidden="true" />
            Acción primaria
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Botones</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary">Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructivo</Button>
            <Button variant="primary" disabled>
              Deshabilitado
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Badges</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="success">Activo</Badge>
            <Badge variant="warning">Stock bajo</Badge>
            <Badge variant="danger">Inactivo</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Estados de carga</h2>
          <div className="mt-3 flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Referencia (mono)</h2>
          <p className="mt-3 font-mono text-sm text-ink">
            IMEI 356938035643809 · SKU PHN-IPH15-128BLK
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <EmptyState
          title="No hay productos todavía"
          description="Este es el lenguaje visual de estado vacío que se reutilizará en cada listado del ERP."
          action={<Button size="sm">Crear el primero</Button>}
        />
      </div>
    </>
  )
}
