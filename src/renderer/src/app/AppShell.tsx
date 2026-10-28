import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NotificationButton } from './NotificationButton'
import { StatusBar } from './StatusBar'
import { ThemeMenu } from './ThemeMenu'
import { Database } from 'lucide-react'
import { DataManagementDialog } from '../pages/data/DataManagementDialog'
import { NotificationDrawer } from '../pages/notifications/NotificationDrawer'

const NAV = [
  { to: '/prescriptions', label: '处方' },
  { to: '/pharmacy', label: '药房' },
  { to: '/finance', label: '财务' }
]
const STORAGE_KEY = 'yanxia:last-module-paths'

function loadLastPaths(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, string>
  } catch {
    // ignore malformed session state
  }
  return {}
}

export function AppShell(): React.JSX.Element {
  const location = useLocation()
  const [lastPaths, setLastPaths] = useState<Record<string, string>>(loadLastPaths)
  const [dataOpen, setDataOpen] = useState(false)
  const [backupDue, setBackupDue] = useState(false)

  useEffect(() => {
    const current = NAV.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    )
    if (!current) return
    const currentPath = `${location.pathname}${location.search}`
    if (lastPaths[current.to] === currentPath) return
    const next = { ...lastPaths, [current.to]: currentPath }
    setLastPaths(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore session storage failures
    }
  }, [location.pathname, location.search, lastPaths])

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      window.api.data
        .status()
        .then((status) => {
          if (!cancelled) setBackupDue(status.due)
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [dataOpen])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">燕</span>
          燕霞诊所
        </div>
        <span className="topbar-divider" />
        <nav className="nav" aria-label="主导航">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={lastPaths[item.to] ?? item.to}
              className={() =>
                `nav-link ${
                  location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`)
                    ? 'active'
                    : ''
                }`.trim()
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <button
            type="button"
            className="topbar-action data-management-button"
            onClick={() => setDataOpen(true)}
            data-testid="data-management-button"
          >
            <Database size={15} />
            数据管理
            {backupDue ? <span className="topbar-alert-dot" data-testid="backup-due-dot" /> : null}
          </button>
          <ThemeMenu />
          <NotificationButton />
        </div>
      </header>
      <main className="page">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
      <StatusBar />
      <NotificationDrawer />
      <DataManagementDialog open={dataOpen} onClose={() => setDataOpen(false)} />
    </div>
  )
}
