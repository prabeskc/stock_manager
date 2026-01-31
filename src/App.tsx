import { useState } from 'react'
import { AppShell, type AppView } from './components/layout/AppShell'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'

export default function App() {
  const [view, setView] = useState<AppView>('dashboard')

  return (
    <AppShell activeView={view} onChangeView={setView}>
      {view === 'dashboard' ? <DashboardPage /> : null}
      {view === 'transactions' ? <TransactionsPage /> : null}
      {view === 'settings' ? <SettingsPage /> : null}
    </AppShell>
  )
}
