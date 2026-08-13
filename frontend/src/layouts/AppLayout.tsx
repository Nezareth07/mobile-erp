import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)

  function closeMobileMenu() {
    setMobileOpen(false)
    mobileMenuTriggerRef.current?.focus()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileMenu}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenMobileMenu={() => setMobileOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
