import { useEffect, useState } from 'react'
import type { DrugDetail } from '@shared/types/models'
import { todayIso } from '@shared/date'
import { computeExpiryDate } from '@shared/expiry'
import { Button, Dialog, Field, TextInput } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'
import { formatDrugStock, totalUnitFactor } from '@shared/drugUnits'

interface PurchaseDialogProps {
  open: boolean
  drug: DrugDetail | null
  onClose: () => void
  onSuccess: () => void
}

export function PurchaseDialog({ open, drug, onClose, onSuccess }: PurchaseDialogProps): React.JSX.Element | null {
  const { showToast } = useToast()
  const [date, setDate] = useState(todayIso())
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [productionYear, setProductionYear] = useState(String(new Date().getFullYear()))
  const [productionMonth, setProductionMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [productionDay, setProductionDay] = useState('')
  const [shelfYears, setShelfYears] = useState('1')
  const [shelfMonths, setShelfMonths] = useState('0')
  const [shelfDays, setShelfDays] = useState('0')

  useEffect(() => {
    if (open && drug) {
      setDate(todayIso())
      setQty('1')
      setProductionYear(String(new Date().getFullYear()))
      setProductionMonth(String(new Date().getMonth() + 1).padStart(2, '0'))
      setProductionDay('')
      setShelfYears('1')
      setShelfMonths('0')
      setShelfDays('0')
    }
  }, [open, drug])

  if (!drug) return null

  const qtyNumber = Math.max(0, Math.floor(Number(qty) || 0))
  const unitCostCents = 0
  const factor = totalUnitFactor(drug.units)
  const nextStockUnits = drug.stockUnits + qtyNumber * factor
  const productionDate = `${productionYear}-${productionMonth.padStart(2, '0')}${
    productionDay ? `-${productionDay.padStart(2, '0')}` : ''
  }`
  const expiryDate = computeExpiryDate(productionDate, {
    years: Number(shelfYears || 0),
    months: Number(shelfMonths || 0),
    days: Number(shelfDays || 0)
  })
  const nextStockLabel = formatDrugStock({
    ...drug,
    stockQty: nextStockUnits / factor,
    stockUnits: nextStockUnits
  })

  const submit = async (): Promise<void> => {
    if (qtyNumber <= 0) {
      showToast('进货数量必须大于 0', 'warning')
      return
    }
    setSaving(true)
    try {
      await window.api.drugs.purchase({
        drugId: drug.id,
        purchaseDate: date,
        qty: qtyNumber,
        unitCostCents,
        productionDate,
        shelfLifeYears: Number(shelfYears || 0),
        shelfLifeMonths: Number(shelfMonths || 0),
        shelfLifeDays: Number(shelfDays || 0)
      })
      showToast(`已进货 ${qtyNumber} ${drug.unit}，库存更新为 ${nextStockLabel}`)
      onSuccess()
      onClose()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={`进货 · ${drug.name}`}
      onClose={onClose}
      testId="purchase-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving} data-testid="confirm-purchase">
            确定进货
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <div className="span-12">
          <Field label="进货日期" required>
            <TextInput
              type="date"
              value={date}
              data-testid="purchase-date"
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>
        <div className="span-6">
          <Field label="进货数量" required>
            <div className="input-group">
              <TextInput
                type="number"
                min={1}
                step={1}
                value={qty}
                data-testid="purchase-qty"
                onChange={(event) => setQty(event.target.value)}
              />
              <span className="unit">{drug.unit}</span>
            </div>
          </Field>
        </div>
        <div className="span-12">
          <Field label="该批生产日期" required hint="年和月必填，日选填">
            <div className="date-parts">
              <label className="date-part"><span>年</span><TextInput type="number" value={productionYear} data-testid="purchase-production-year" onChange={(e) => setProductionYear(e.target.value)} /></label>
              <label className="date-part"><span>月</span><TextInput type="number" value={productionMonth} data-testid="purchase-production-month" onChange={(e) => setProductionMonth(e.target.value)} /></label>
              <label className="date-part"><span>日（选填）</span><TextInput type="number" value={productionDay} data-testid="purchase-production-day" onChange={(e) => setProductionDay(e.target.value)} /></label>
            </div>
          </Field>
        </div>
        <div className="span-12">
          <Field label="该批保质期" required hint="可组合填写年、月、天">
            <div className="date-parts">
              <label className="date-part"><span>年</span><TextInput type="number" min={0} value={shelfYears} data-testid="purchase-shelf-years" onChange={(e) => setShelfYears(e.target.value)} /></label>
              <label className="date-part"><span>月</span><TextInput type="number" min={0} value={shelfMonths} data-testid="purchase-shelf-months" onChange={(e) => setShelfMonths(e.target.value)} /></label>
              <label className="date-part"><span>天</span><TextInput type="number" min={0} value={shelfDays} data-testid="purchase-shelf-days" onChange={(e) => setShelfDays(e.target.value)} /></label>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>到期日：{expiryDate || '—'}</div>
          </Field>
        </div>
        <div className="span-12">
          <div className="fee-panel" style={{ padding: 12 }}>
            <div className="fee-row">
              <span className="fee-label">确认后库存</span>
              <span className="fee-value">
                {formatDrugStock(drug)} → {nextStockLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
