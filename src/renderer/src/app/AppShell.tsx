import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NotificationButton } from './NotificationButton'
import { StatusBar } from './StatusBar'
import { ThemeMenu } from './ThemeMenu'
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

  useEffect(() => {
    const current = NAV.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    )
    if (!current) return
    if (lastPaths[current.to] === location.pathname) return
    const next = { ...lastPaths, [current.to]: location.pathname }
    setLastPaths(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore session storage failures
    }
  }, [location.pathname, lastPaths])

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
    </div>
  )
}
