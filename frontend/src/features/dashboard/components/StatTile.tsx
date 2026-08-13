import { Card } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'

export interface StatTileProps {
  label: string
  value: string
  loading?: boolean
  error?: boolean
}

export function StatTile({ label, value, loading, error }: StatTileProps) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : error ? (
        <p className="mt-1 text-sm text-danger">No disponible</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      )}
    </Card>
  )
}
