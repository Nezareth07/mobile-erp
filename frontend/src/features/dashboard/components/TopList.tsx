import { EmptyState } from '../../../components/feedback/EmptyState'

export interface TopListItem {
  id: string
  primary: string
  secondary: string
  amount: string
}

export interface TopListProps {
  items: TopListItem[]
  emptyMessage: string
}

export function TopList({ items, emptyMessage }: TopListProps) {
  if (items.length === 0) {
    return <EmptyState title={emptyMessage} />
  }

  return (
    <ol className="divide-y divide-line">
      {items.map((item, index) => (
        <li key={item.id} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-sm font-medium text-ink-muted">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {item.primary}
            </p>
            <p className="text-xs text-ink-muted">{item.secondary}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-ink">
            {item.amount}
          </span>
        </li>
      ))}
    </ol>
  )
}
