import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import type { PrescriptionDetail } from '@shared/types/models'
import { buildPrescriptionHtml } from '@shared/printTemplate'
import {
  PRINT_PAGE_HEIGHT_PX,
  countPrescriptionPages
} from '@shared/prescriptionPrintLayout'
import templateUrl from '../../assets/prescription-template.jpg'
import { Button, EmptyState } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'

export function PrescriptionPrintPage(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [details, setDetails] = useState<PrescriptionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = useMemo(
    () =>
      (params.get('ids') ?? '')
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    [params]
  )

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const loaded = await Promise.all(ids.map((id) => window.api.prescriptions.get(id)))
        if (!cancelled) setDetails(loaded)
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (ids.length === 0) {
      setLoading(false)
      setDetails([])
      return
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ids])

  const pageCount = useMemo(() => countPrescriptionPages(details), [details])
  const html = useMemo(
    () => (details.length ? buildPrescriptionHtml(details, { templateUrl }) : ''),
    [details]
  )

  const run = async (action: 'print' | 'export'): Promise<void> => {
    if (!ids.length) return
    setBusy(true)
    try {
      const result =
        action === 'print'
          ? await window.api.print.printPrescription(ids)
          : await window.api.print.exportPdf(ids)
      showToast(
        result.path ? `已生成 PDF：${result.path}` : '已取消导出',
        result.path ? 'success' : 'info'
      )
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print-page" data-testid="print-page">
      <div className="print-toolbar">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <span className="print-title">处方打印预览{details.length ? `（${details.length} 张）` : ''}</span>
        <div className="print-toolbar-actions">
          <Button
            variant="secondary"
            icon={<Download size={15} />}
            disabled={!details.length || busy}
            onClick={() => void run('export')}
          >
            导出 PDF
          </Button>
          <Button
            variant="primary"
            icon={<Printer size={15} />}
            disabled={!details.length || busy}
            onClick={() => void run('print')}
          >
            打印
          </Button>
        </div>
      </div>
      <div className="print-frame-wrap">
        {loading ? (
          <div className="muted" style={{ padding: 24 }}>
            正在生成预览…
          </div>
        ) : error ? (
          <div className="inline-error" style={{ maxWidth: 640, margin: '24px auto' }}>
            {error}
          </div>
        ) : details.length === 0 ? (
          <EmptyState title="没有可预览的处方" description="请从处方列表选择要打印的处方。" />
        ) : (
          <iframe
            className="print-frame"
            title="处方打印预览"
            srcDoc={html}
            style={{ height: Math.max(pageCount, 1) * PRINT_PAGE_HEIGHT_PX }}
          />
        )}
      </div>
    </div>
  )
}
