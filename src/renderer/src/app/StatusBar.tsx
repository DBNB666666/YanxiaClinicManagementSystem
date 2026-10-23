import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/types/models'
import { formatDateTime } from '@shared/date'

export function StatusBar(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.app
      .getInfo()
      .then((value) => {
        if (!cancelled) setInfo(value)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className="statusbar">
      <span className="status-dot" />
      <span>数据已保存</span>
      <span className="statusbar-right">
        {info?.lastBackupAt ? `上次备份：${formatDateTime(info.lastBackupAt)}` : '尚未备份'}
      </span>
    </footer>
  )
}
