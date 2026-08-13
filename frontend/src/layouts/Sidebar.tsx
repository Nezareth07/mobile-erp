import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
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

interface NavItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'catalogo', label: 'Catálogo', icon: Package },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'ventas', label: 'Ventas', icon: Receipt },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'administracion', label: 'Administración', icon: ShieldCheck },
]

export interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id)
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
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId
            const Icon = item.icon

            return (
              <li key={item.id}>
                <button
                  type="button"
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-transparent text-ink-muted hover:bg-canvas hover:text-ink',
                    collapsed && 'md:justify-center',
                  )}
                >
                  <Icon size={20} className="shrink-0" aria-hidden={true} />
                  <span className={cn(collapsed && 'md:hidden')}>
                    {item.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
