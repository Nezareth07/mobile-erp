import { Menu, PanelLeft, User } from 'lucide-react'
import type { RefObject } from 'react'

export interface HeaderProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenMobileMenu: () => void
  mobileMenuTriggerRef: RefObject<HTMLButtonElement | null>
}

export function Header({
  collapsed,
  onToggleCollapse,
  onOpenMobileMenu,
  mobileMenuTriggerRef,
}: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={
            collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'
          }
          className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:inline-flex"
        >
          <PanelLeft size={20} aria-hidden="true" />
        </button>

        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú de navegación"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="hidden sm:inline">Cuenta</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-ink-muted">
          <User size={16} aria-hidden="true" />
        </span>
      </div>
    </header>
  )
}
