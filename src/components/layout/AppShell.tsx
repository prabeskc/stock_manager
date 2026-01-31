import type { ReactNode } from 'react'
import { Input } from '../ui/Input'

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
  const pageTitle =
    activeView === 'dashboard'
      ? 'Dashboard'
      : activeView === 'transactions'
        ? 'Transactions'
        : 'Settings'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-[1440px] gap-4 p-3 sm:p-4 md:gap-6 md:p-6">
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="h-full rounded-2xl bg-slate-950 p-4 text-slate-100 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-wide text-white">
              AFNAI SHIVASHATI HARDWARE
            </div>
            <div className="mt-1 text-sm text-slate-400">Stock manager</div>

            <nav className="mt-6 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={[
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-base transition',
                    item.view === activeView
                      ? 'bg-white/10 text-white'
                      : 'text-slate-200 hover:bg-white/5',
                  ].join(' ')}
                  onClick={() => onChangeView(item.view)}
                  type="button"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-lime-400/90" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="min-w-0">
              <div className="truncate text-base font-bold uppercase tracking-wide text-slate-900">
                {pageTitle}
              </div>
              <div className="truncate text-sm text-slate-500">Track stock, CP/SP, and profit</div>
            </div>

            <div className="flex min-w-[240px] flex-1 items-center justify-end gap-3 md:min-w-[360px]">
              <div className="relative w-full max-w-md">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l2.63 2.63a.75.75 0 1 0 1.06-1.06l-2.63-2.63A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <Input
                  placeholder="Search items, transactions…"
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-semibold text-slate-900">Admin</div>
                  <div className="text-xs text-slate-500">Owner</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  A
                </div>
              </div>
            </div>
          </header>

          <div className="md:hidden">
            <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl bg-slate-950 p-2 text-slate-100 shadow-sm">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={[
                    'min-h-11 whitespace-nowrap rounded-xl px-4 py-3 text-base transition',
                    item.view === activeView
                      ? 'bg-white/10 text-white'
                      : 'text-slate-200 hover:bg-white/5',
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
