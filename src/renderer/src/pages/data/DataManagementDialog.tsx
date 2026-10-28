import { useCallback, useEffect, useRef, useState } from 'react'
import { Database, Download, Upload } from 'lucide-react'
import type { AppInfo } from '@shared/types/models'
import type { DataStatus } from '@shared/types/api'
import { formatDateTime } from '@shared/date'
import { Banner, Button, Dialog, Field, TextInput } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'

interface DataManagementDialogProps {
  open: boolean
  onClose: () => void
}

function fileStamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}`
}

export function DataManagementDialog({
  open,
  onClose
}: DataManagementDialogProps): React.JSX.Element {
  const { showToast } = useToast()
  const [status, setStatus] = useState<DataStatus | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [interval, setIntervalDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const [nextStatus, info] = await Promise.all([
        window.api.data.status(),
        window.api.app.getInfo()
      ])
      setStatus(nextStatus)
      setAppInfo(info)
      setIntervalDays(String(nextStatus.intervalDays))
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    }
  }, [showToast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const backup = async (): Promise<void> => {
    setBusy(true)
    try {
      const info = await window.api.app.getInfo()
      const file = await window.api.data.export(info.version)
      const blob = new Blob([JSON.stringify(file, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `燕霞诊所数据备份-${fileStamp()}.yxbackup`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      showToast('备份文件已生成')
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const chooseImport = (): void => {
    fileRef.current?.click()
  }

  const importFile = async (file: File): Promise<void> => {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      const result = await window.api.data.import(parsed)
      showToast(
        `导入完成：新增药品 ${result.drugs}、处方 ${result.prescriptions}、进货 ${result.purchases}、组合 ${result.combos}，跳过重复 ${result.skipped}`
      )
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const saveInterval = async (): Promise<void> => {
    const days = Number(interval)
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      showToast('备份提醒周期必须是 1–365 的整数天', 'warning')
      return
    }
    setBusy(true)
    try {
      await window.api.data.setInterval(days)
      showToast('备份提醒周期已保存')
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      title="数据管理"
      onClose={onClose}
      testId="data-management-dialog"
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      {status?.due ? (
        <Banner tone="warning">
          <span data-testid="backup-due-alert">
            {status.lastBackupAt
              ? `距上次备份已 ${status.daysSince} 天，请及时备份数据`
              : '还没有生成过数据备份，请立即备份'}
          </span>
        </Banner>
      ) : null}

      <div className="data-management">
        <div className="data-management-status">
          <div>
            <span className="info-label">上次备份</span>
            <strong data-testid="last-backup-at">
              {status?.lastBackupAt ? formatDateTime(status.lastBackupAt) : '从未备份'}
            </strong>
          </div>
          <div>
            <span className="info-label">当前版本</span>
            <strong>{appInfo?.version ?? '—'}</strong>
          </div>
          <div>
            <span className="info-label">提醒周期</span>
            <strong>每 {status?.intervalDays ?? 7} 天</strong>
          </div>
        </div>

        <div className="data-management-actions">
          <Button
            variant="primary"
            icon={<Download size={16} />}
            loading={busy}
            onClick={() => void backup()}
            data-testid="backup-data"
          >
            备份全部数据
          </Button>
          <Button
            variant="secondary"
            icon={<Upload size={16} />}
            loading={busy}
            onClick={chooseImport}
            data-testid="import-data"
          >
            导入数据
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".yxbackup,application/json"
            hidden
            data-testid="import-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFile(file)
            }}
          />
        </div>

        <div className="data-management-interval">
          <Field label="备份提醒周期" hint="每 N 天提醒一次，范围 1–365 天">
            <div className="flex gap-8">
              <TextInput
                type="number"
                min={1}
                max={365}
                value={interval}
                data-testid="backup-interval"
                onChange={(event) => setIntervalDays(event.target.value)}
              />
              <span className="muted" style={{ alignSelf: 'center' }}>
                天
              </span>
              <Button
                variant="secondary"
                onClick={() => void saveInterval()}
                loading={busy}
                data-testid="save-backup-interval"
              >
                保存周期
              </Button>
            </div>
          </Field>
        </div>

        <div className="data-management-note">
          <Database size={18} />
          <span>
            备份文件包含药品、批次、处方、进货、用药组合等业务数据，以及备份时间、软件版本和记录 UUID。
            导入时按 UUID 跳过重复记录，不会覆盖本机设置和签名。
          </span>
        </div>
      </div>
    </Dialog>
  )
}
