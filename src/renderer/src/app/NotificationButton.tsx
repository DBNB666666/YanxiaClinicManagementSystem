import { Bell } from 'lucide-react'
import { useNotifications } from '../context/NotificationProvider'

export function NotificationButton(): React.JSX.Element {
  const { unreadCount, setOpen } = useNotifications()
  return (
    <button
      type="button"
      className="bell-button"
      aria-label={`通知${unreadCount > 0 ? `，${unreadCount} 条未读` : ''}`}
      data-testid="notification-button"
      onClick={() => setOpen(true)}
    >
      <Bell size={19} />
      {unreadCount > 0 ? (
        <span className="bell-dot" data-testid="notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
  )
}
