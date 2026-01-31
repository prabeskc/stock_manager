import { Button } from '../ui/Button'
import type { ReactNode } from 'react'

export type AppView = 'dashboard' | 'transactions' | 'settings'

export type AppShellProps = {
  activeView: AppView
  onChangeView: (view: AppView) => void
  children: ReactNode
}

const navItems: Array<{ view: AppView; label: string }> = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'transactions', label: 'Transactions' },
  { view: 'settings', label: 'Settings' },
]

export function AppShell({ activeView, onChangeView, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl gap-6 p-4 md:p-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold">Hardware Stock</div>
            <div className="mt-1 text-xs text-slate-500">Iron Rod Manager</div>
            <nav className="mt-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={[
                    'flex h-10 items-center rounded-md px-3 text-sm transition',
                    item.view === activeView
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                  onClick={() => onChangeView(item.view)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Iron Rod Inventory Dashboard</div>
              <div className="truncate text-xs text-slate-500">
                Track 8mm, 10mm, 12mm stock, CP/SP, and profit
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="secondary"
                onClick={() => onChangeView('dashboard')}
                type="button"
              >
                Dashboard
              </Button>
            </div>
          </header>

          <div className="md:hidden">
            <div className="mb-4 flex gap-2 overflow-x-auto rounded-xl bg-white p-2 ring-1 ring-slate-200">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={[
                    'whitespace-nowrap rounded-md px-3 py-2 text-sm transition',
                    item.view === activeView
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                  onClick={() => onChangeView(item.view)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
