import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import type { PrescriptionDetail } from '@shared/types/models'
import { buildPrescriptionHtml } from '@shared/printTemplate'
import {
  PRINT_PAGE_HEIGHT_PX,
  PRINT_PAGE_WIDTH_PX,
  countPrescriptionPages
} from '@shared/prescriptionPrintLayout'
import templateUrl from '../../assets/prescription-template.jpg'
import { Button, EmptyState } from '../../components/Ui'
import { useSettings } from '../../context/SettingsProvider'
import { useToast } from '../../context/ToastProvider'

export function PrescriptionPrintPage(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { settings, setSignatureLayout } = useSettings()
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
  const [signatureLayout, setLocalSignatureLayout] = useState({
    x: settings.signatureX,
    y: settings.signatureY,
    width: settings.signatureWidth
  })
  const layoutRef = useRef(signatureLayout)

  useEffect(() => {
    const next = {
      x: settings.signatureX,
      y: settings.signatureY,
      width: settings.signatureWidth
    }
    layoutRef.current = next
    setLocalSignatureLayout(next)
  }, [settings.signatureX, settings.signatureY, settings.signatureWidth])

  const canEditSignature = details.length === 1 && Boolean(settings.signatureImage)
  const html = useMemo(
    () =>
      details.length
        ? buildPrescriptionHtml(details, {
            templateUrl,
            signatureImage: settings.signatureImage,
            signatureLayout,
            hideSignature: canEditSignature
          })
        : '',
    [details, settings.signatureImage, signatureLayout, canEditSignature]
  )

  const beginSignatureGesture = (
    mode: 'move' | 'resize'
  ): ((event: ReactPointerEvent) => void) => {
    return (event) => {
      event.preventDefault()
      event.stopPropagation()
      const start = {
        mode,
        clientX: event.clientX,
        clientY: event.clientY,
        ...layoutRef.current
      }
      const onMove = (moveEvent: PointerEvent): void => {
        const dx = (moveEvent.clientX - start.clientX) / PRINT_PAGE_WIDTH_PX
        const dy = (moveEvent.clientY - start.clientY) / PRINT_PAGE_HEIGHT_PX
        let next = { ...layoutRef.current }
        if (mode === 'move') {
          next.x = Math.min(1 - start.width, Math.max(0, start.x + dx))
          next.y = Math.min(0.95, Math.max(0, start.y + dy))
        } else {
          next.width = Math.min(0.6, Math.max(0.05, start.width + dx))
          next.x = Math.min(next.x, 1 - next.width)
        }
        layoutRef.current = next
        setLocalSignatureLayout(next)
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        void setSignatureLayout(layoutRef.current).catch((cause: Error) =>
          showToast(cause.message, 'error')
        )
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

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
          <div
            className="print-canvas"
            style={{
              width: PRINT_PAGE_WIDTH_PX,
              height: Math.max(pageCount, 1) * PRINT_PAGE_HEIGHT_PX
            }}
          >
            <iframe
              className="print-frame"
              title="处方打印预览"
              srcDoc={html}
              style={{ height: Math.max(pageCount, 1) * PRINT_PAGE_HEIGHT_PX }}
            />
            {canEditSignature ? (
              <div
                className="signature-editor"
                data-testid="signature-drag"
                style={{
                  left: `${signatureLayout.x * 100}%`,
                  top: `${((pageCount - 1 + signatureLayout.y) / Math.max(pageCount, 1)) * 100}%`,
                  width: `${signatureLayout.width * 100}%`
                }}
                onPointerDown={beginSignatureGesture('move')}
                title="拖动调整签名位置"
              >
                <img src={settings.signatureImage} alt="拖动医师签名" draggable={false} />
                <span
                  className="signature-resize-handle"
                  data-testid="signature-resize"
                  onPointerDown={beginSignatureGesture('resize')}
                  title="拖动等比缩放"
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
