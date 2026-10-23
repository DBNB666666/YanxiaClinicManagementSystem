import { NavLink, Outlet } from 'react-router-dom'
import { NotificationButton } from './NotificationButton'
import { StatusBar } from './StatusBar'
import { ThemeMenu } from './ThemeMenu'
import { NotificationDrawer } from '../pages/notifications/NotificationDrawer'

const NAV = [
  { to: '/prescriptions', label: '处方' },
  { to: '/pharmacy', label: '药房' },
  { to: '/finance', label: '财务' }
]

export function AppShell(): React.JSX.Element {
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
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`.trim()}
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
