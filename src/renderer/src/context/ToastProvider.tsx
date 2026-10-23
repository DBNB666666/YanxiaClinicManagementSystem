import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'success', duration = 3500) => {
      const id = nextId.current++
      setItems((current) => [...current.slice(-1), { id, message, kind }])
      window.setTimeout(() => remove(id), duration)
    },
    [remove]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.kind}`} role="status">
            <span>{item.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="关闭提示"
              onClick={() => remove(item.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast 必须在 ToastProvider 内使用')
  return value
}
