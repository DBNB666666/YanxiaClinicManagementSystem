import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

interface NotificationContextValue {
  unreadCount: number
  open: boolean
  setOpen: (open: boolean) => void
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const result = await window.api.notifications.unreadCount()
      setUnreadCount(result.count)
    } catch {
      // 通知失败不阻塞主流程
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const value = useMemo(
    () => ({ unreadCount, open, setOpen, refresh }),
    [unreadCount, open, refresh]
  )
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext)
  if (!value) throw new Error('useNotifications 必须在 NotificationProvider 内使用')
  return value
}
