import { useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { cn } from '../lib/cn'

interface LinkedNavItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  to: string
  end?: boolean
}

// Every item is wired to a real route and rendered as a NavLink. 'reportes'
// (F12) was the last placeholder -- no non-navigable buttons remain.
const LINKED_NAV_ITEMS: LinkedNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/', end: true },
  { id: 'catalogo', label: 'Catálogo', icon: Package, to: '/catalogo' },
  { id: 'proveedores', label: 'Proveedores', icon: Truck, to: '/proveedores' },
  { id: 'inventario', label: 'Inventario', icon: Boxes, to: '/inventario' },
  { id: 'clientes', label: 'Clientes', icon: Users, to: '/clientes' },
  { id: 'compras', label: 'Compras', icon: ShoppingCart, to: '/compras' },
  { id: 'ventas', label: 'Ventas', icon: Receipt, to: '/ventas' },
  {
    id: 'administracion',
    label: 'Administración',
    icon: ShieldCheck,
    to: '/administracion',
  },
  { id: 'reportes', label: 'Reportes', icon: BarChart3, to: '/reportes' },
]

export interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}

const navItemClasses = (isActive: boolean, collapsed: boolean) =>
  cn(
    'flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    isActive
      ? 'border-primary bg-primary-subtle text-primary'
      : 'border-transparent text-ink-muted hover:bg-canvas hover:text-ink',
    collapsed && 'md:justify-center',
  )

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus()
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseMobile()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, onCloseMobile])

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 md:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
      />

      <nav
        aria-label="Principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface',
          'transition-transform duration-200 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'md:w-16',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4 md:hidden">
          <span className="text-sm font-semibold text-ink">MobileERP</span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Cerrar menú"
            onClick={onCloseMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {LINKED_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  navItemClasses(isActive, collapsed)
                }
              >
                <item.icon size={20} className="shrink-0" aria-hidden={true} />
                <span className={cn(collapsed && 'md:hidden')}>
                  {item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
