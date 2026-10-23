import { HashRouter } from 'react-router-dom'
import { ToastProvider } from './context/ToastProvider'
import { SettingsProvider } from './context/SettingsProvider'
import { NotificationProvider } from './context/NotificationProvider'
import { AppRoutes } from './router'

export function App(): React.JSX.Element {
  return (
    <ToastProvider>
      <SettingsProvider>
        <NotificationProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </NotificationProvider>
      </SettingsProvider>
    </ToastProvider>
  )
}
