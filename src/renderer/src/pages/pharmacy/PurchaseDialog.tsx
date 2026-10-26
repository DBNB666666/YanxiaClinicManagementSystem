import { useEffect, useState } from 'react'
import type { DrugDetail } from '@shared/types/models'
import { todayIso } from '@shared/date'
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

  useEffect(() => {
    if (open && drug) {
      setDate(todayIso())
      setQty('1')
    }
  }, [open, drug])

  if (!drug) return null

  const qtyNumber = Math.max(0, Math.floor(Number(qty) || 0))
  const unitCostCents = 0
  const factor = totalUnitFactor(drug.units)
  const nextStockUnits = drug.stockUnits + qtyNumber * factor
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
        unitCostCents
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
