import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import type { Notification } from '@shared/types/models'
import { formatDateTime } from '@shared/date'
import { Button, Drawer, EmptyState } from '../../components/Ui'
import { useNotifications } from '../../context/NotificationProvider'
import { useToast } from '../../context/ToastProvider'

export function NotificationDrawer(): React.JSX.Element {
  const { open, setOpen, refresh } = useNotifications()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    window.api.notifications
      .list()
      .then((result) => {
        if (!cancelled) setItems(result.items)
      })
      .catch((error: Error) => {
        if (!cancelled) showToast(error.message, 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, showToast])

  const markAll = async (): Promise<void> => {
    try {
      await window.api.notifications.markAllRead()
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
      await refresh()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const openItem = async (item: Notification): Promise<void> => {
    try {
      if (!item.readAt) {
        await window.api.notifications.markRead(item.id)
        await refresh()
      }
      setOpen(false)
      navigate(`/pharmacy/${item.drugId}`)
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const unread = items.filter((item) => !item.readAt).length

  return (
    <Drawer open={open} title="通知" onClose={() => setOpen(false)} testId="notification-drawer">
      <div className="flex gap-8" style={{ marginBottom: 12 }}>
        <span className="muted">{unread > 0 ? `${unread} 条未读` : '全部已读'}</span>
        {unread > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<CheckCheck size={15} />}
            onClick={() => void markAll()}
            data-testid="mark-all-read"
          >
            全部已读
          </Button>
        ) : null}
      </div>
      {loading ? (
        <div className="muted">正在加载…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell size={22} />}
          title="暂无通知"
          description="库存低于预警值或药品即将过期时会在这里提醒。"
        />
      ) : (
        <div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-item ${item.readAt ? '' : 'unread'}`.trim()}
              data-testid={`notification-${item.id}`}
              onClick={() => void openItem(item)}
            >
              <span className="notification-dot" />
              <span className="notification-body">
                <span className="notification-name">{item.drugName}</span>
                <span className="notification-meta">
                  {item.reason === 'expiry'
                    ? `请注意，${item.drugName}还有一个半月过期（到期日：${item.expiryDate}）`
                    : `当前 ${item.stockQty} · 预警值 ${item.warningQty}`}
                </span>
                <span className="notification-time">{formatDateTime(item.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  )
}
