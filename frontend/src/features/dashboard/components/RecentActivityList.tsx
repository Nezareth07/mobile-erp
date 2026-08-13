import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import type { BadgeVariant } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/feedback/EmptyState'
import type { MovementType, RecentActivityItem } from '../types/dashboard'

export interface RecentActivityListProps {
  items: RecentActivityItem[]
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase_in: 'Compra',
  sale_out: 'Venta',
  adjustment_in: 'Ajuste (entrada)',
  adjustment_out: 'Ajuste (salida)',
  return_in: 'Devolución (entrada)',
  return_out: 'Devolución (salida)',
  warranty_out: 'Garantía (salida)',
  warranty_in: 'Garantía (entrada)',
  transfer_in: 'Transferencia (entrada)',
  transfer_out: 'Transferencia (salida)',
}

const INBOUND_TYPES: ReadonlySet<MovementType> = new Set([
  'purchase_in',
  'adjustment_in',
  'return_in',
  'warranty_in',
  'transfer_in',
])

function movementVariant(type: MovementType): BadgeVariant {
  return INBOUND_TYPES.has(type) ? 'success' : 'danger'
}

const timeFormatter = new Intl.DateTimeFormat('es-419', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function RecentActivityList({ items }: RecentActivityListProps) {
  if (items.length === 0) {
    return <EmptyState title="Sin movimientos recientes" />
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const inbound = INBOUND_TYPES.has(item.movement_type)
        const Icon = inbound ? ArrowDownCircle : ArrowUpCircle

        return (
          <li key={item.id} className="flex items-start gap-3 py-2.5">
            <Icon
              size={18}
              className={inbound ? 'text-success shrink-0' : 'text-danger shrink-0'}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {item.product.name}
              </p>
              <p className="text-xs text-ink-muted">
                {item.location.name}
                {item.quantity !== null ? ` · ${item.quantity} u.` : ''}
                {' · '}
                {timeFormatter.format(new Date(item.created_at))}
              </p>
            </div>
            <Badge variant={movementVariant(item.movement_type)}>
              {MOVEMENT_LABELS[item.movement_type]}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
