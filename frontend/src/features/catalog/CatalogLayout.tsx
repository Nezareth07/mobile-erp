import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn'

const TABS = [
  { to: '/catalogo/productos', label: 'Productos' },
  { to: '/catalogo/marcas', label: 'Marcas' },
  { to: '/catalogo/categorias', label: 'Categorías' },
]

export function CatalogLayout() {
  return (
    <div>
      <nav
        aria-label="Catálogo"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
