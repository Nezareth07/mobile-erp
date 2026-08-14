import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn'

const TABS = [
  { to: '/inventario', label: 'Valuación', end: true },
  { to: '/inventario/movimientos', label: 'Movimientos', end: false },
]

export function InventoryLayout() {
  return (
    <div>
      <nav
        aria-label="Inventario"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  )
}
