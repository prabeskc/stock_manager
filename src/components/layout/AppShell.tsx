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
      <div className="mx-auto flex w-full max-w-[1440px] gap-4 p-3 sm:p-4 md:gap-6 md:p-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-base font-semibold">Hardware Stock</div>
            <div className="mt-1 text-sm text-slate-500">Iron Rod Manager</div>
            <nav className="mt-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={[
                    'flex min-h-11 items-center rounded-md px-3 text-base transition',
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
              <div className="truncate text-base font-bold uppercase tracking-wide">
                AFNAI SHIVASHATI HARDWARE
              </div>
              <div className="truncate text-sm text-slate-500">
                Track iron rods and cement stock, CP/SP, and profit
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
                    'min-h-11 whitespace-nowrap rounded-md px-4 py-3 text-base transition',
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
