import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { DrugInput, DrugUnitInput } from '@shared/types/models'
import { centsToInput, toCents } from '@shared/money'
import { todayIso } from '@shared/date'
import { computeExpiryDate, parseProductionDate } from '@shared/expiry'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  PageHeader,
  TextArea,
  TextInput
} from '../../components/Ui'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { useToast } from '../../context/ToastProvider'
import { formatDrugStock } from '@shared/drugUnits'

interface DrugForm {
  name: string
  inboundDate: string
  productionYear: string
  productionMonth: string
  productionDay: string
  shelfYears: string
  shelfMonths: string
  shelfDays: string
  stockQty: string
  unit: string
  warningQty: string
  category: string
  supplier: string
  indications: string
  cost: string
  price: string
}

interface SubunitForm {
  unit: string
  factor: string
  price: string
  cost: string
}

function emptyForm(): DrugForm {
  return {
    name: '',
    inboundDate: todayIso(),
    productionYear: String(new Date().getFullYear()),
    productionMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
    productionDay: '',
    shelfYears: '1',
    shelfMonths: '0',
    shelfDays: '0',
    stockQty: '0',
    unit: '盒',
    warningQty: '5',
    category: '',
    supplier: '',
    indications: '',
    cost: '0.00',
    price: '0.00'
  }
}

function safeCents(value: string): number {
  try {
    return toCents(value || '0')
  } catch {
    return 0
  }
}

export function DrugEditPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const editId = id ? Number(id) : null
  const backTarget = editId ? `/pharmacy/${editId}` : '/pharmacy'
  const [form, setForm] = useState<DrugForm>(emptyForm)
  const [subunits, setSubunits] = useState<SubunitForm[]>([])
  const [stockOpen, setStockOpen] = useState(false)
  const [stockBaseDraft, setStockBaseDraft] = useState('0')
  const [stockLooseDraft, setStockLooseDraft] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  useEffect(() => {
    if (!editId) {
      setLoading(false)
      return
    }
    let cancelled = false
    window.api.drugs
      .get(editId)
      .then((drug) => {
        if (cancelled) return
        setForm({
          name: drug.name,
          inboundDate: drug.inboundDate,
          productionYear: parseProductionDate(drug.productionDate)?.year
            ? String(parseProductionDate(drug.productionDate)!.year)
            : '',
          productionMonth: parseProductionDate(drug.productionDate)?.month
            ? String(parseProductionDate(drug.productionDate)!.month).padStart(2, '0')
            : '',
          productionDay: parseProductionDate(drug.productionDate)?.day
            ? String(parseProductionDate(drug.productionDate)!.day).padStart(2, '0')
            : '',
          shelfYears: String(drug.shelfLifeYears ?? 0),
          shelfMonths: String(drug.shelfLifeMonths ?? 0),
          shelfDays: String(drug.shelfLifeDays ?? 0),
          stockQty: String(drug.stockQty),
          unit: drug.unit,
          warningQty: String(drug.warningQty),
          category: drug.category,
          supplier: drug.supplier,
          indications: drug.indications,
          cost: centsToInput(drug.costCents),
          price: centsToInput(drug.priceCents)
        })
        setSubunits(
          (drug.units ?? []).map((unit) => ({
            unit: unit.unit,
            factor: String(unit.factor),
            price: centsToInput(unit.priceCents),
            cost: centsToInput(unit.costCents)
          }))
        )
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  const setField = <K extends keyof DrugForm>(key: K, value: DrugForm[K]): void => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const costCents = safeCents(form.cost)
  const priceCents = safeCents(form.price)
  const displayUnits = subunits.map((row) => ({
    id: 0,
    unit: row.unit || '单位',
    factor: Math.max(0.0001, Number(row.factor) || 1),
    priceCents: safeCents(row.price),
    costCents: safeCents(row.cost)
  }))
  const totalFactor = displayUnits.reduce((total, unit) => total * unit.factor, 1)
  const stockUnits = Math.round(Number(form.stockQty || '0') * totalFactor)
  const productionDatePreview =
    form.productionYear && form.productionMonth
      ? `${form.productionYear.padStart(4, '0')}-${form.productionMonth.padStart(2, '0')}${
          form.productionDay ? `-${form.productionDay.padStart(2, '0')}` : ''
        }`
      : ''
  const expiryPreview = computeExpiryDate(productionDatePreview, {
    years: Number(form.shelfYears || 0),
    months: Number(form.shelfMonths || 0),
    days: Number(form.shelfDays || 0)
  })
  const stockLabel = formatDrugStock({
    unit: form.unit || '单位',
    stockQty: stockUnits / totalFactor,
    stockUnits,
    units: displayUnits
  })

  const openStockAdjust = (): void => {
    let remainder = stockUnits
    const base = Math.floor(remainder / totalFactor)
    remainder -= base * totalFactor
    const loose: string[] = []
    let cumulative = 1
    for (const unit of displayUnits) {
      cumulative *= unit.factor
      const unitSize = totalFactor / cumulative
      const count = Math.floor(remainder / unitSize)
      remainder -= count * unitSize
      loose.push(String(count))
    }
    setStockBaseDraft(String(base))
    setStockLooseDraft(loose)
    setStockOpen(true)
  }

  const confirmStockAdjust = (): void => {
    const base = Number(stockBaseDraft)
    if (!Number.isInteger(base) || base < 0) {
      showToast('整盒数量必须是非负整数', 'warning')
      return
    }
    let nextUnits = base * totalFactor
    let cumulative = 1
    for (let index = 0; index < displayUnits.length; index += 1) {
      const count = Number(stockLooseDraft[index] ?? 0)
      if (!Number.isInteger(count) || count < 0) {
        showToast('零头数量必须是非负整数', 'warning')
        return
      }
      cumulative *= displayUnits[index].factor
      nextUnits += count * (totalFactor / cumulative)
    }
    setForm((current) => ({ ...current, stockQty: String(nextUnits / totalFactor) }))
    setStockOpen(false)
    setDirty(true)
  }

  const save = async (): Promise<void> => {
    if (!form.name.trim() || !form.unit.trim()) {
      showToast('请填写药品名称和单位', 'warning')
      return
    }
    const productionYear = Number(form.productionYear)
    const productionMonth = Number(form.productionMonth)
    const productionDay = form.productionDay ? Number(form.productionDay) : null
    const shelfYears = Number(form.shelfYears || 0)
    const shelfMonths = Number(form.shelfMonths || 0)
    const shelfDays = Number(form.shelfDays || 0)
    const hasProduction = Boolean(form.productionYear || form.productionMonth || form.productionDay)
    if (!editId || hasProduction) {
      if (
        !Number.isInteger(productionYear) ||
        productionYear < 1900 ||
        !Number.isInteger(productionMonth) ||
        productionMonth < 1 ||
        productionMonth > 12
      ) {
        showToast('生产日期必须填写年和月', 'warning')
        return
      }
      if (productionDay !== null && (!Number.isInteger(productionDay) || productionDay < 1 || productionDay > 31)) {
        showToast('生产日填写不正确', 'warning')
        return
      }
      if (shelfYears + shelfMonths + shelfDays <= 0) {
        showToast('请填写保质期', 'warning')
        return
      }
    }
    const stockQty = Number(form.stockQty)
    const warningQty = Number(form.warningQty)
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      showToast('库存数量必须是非负数', 'warning')
      return
    }
    if (!Number.isFinite(warningQty) || warningQty < 0) {
      showToast('预警库存必须是非负数', 'warning')
      return
    }
    const units: DrugUnitInput[] = []
    for (const row of subunits) {
      if (!row.unit.trim()) {
        showToast('请填写细分单位名称', 'warning')
        return
      }
      const factor = Number(row.factor)
      if (!Number.isFinite(factor) || factor <= 0) {
        showToast('细分换算比例必须大于 0', 'warning')
        return
      }
      units.push({
        unit: row.unit.trim(),
        factor,
        priceCents: safeCents(row.price),
        costCents: safeCents(row.cost)
      })
    }
    setSaving(true)
    setError(null)
    const input: DrugInput = {
      name: form.name.trim(),
      inboundDate: form.inboundDate,
      stockQty,
      unit: form.unit.trim(),
      warningQty,
      category: form.category.trim(),
      supplier: form.supplier.trim(),
      indications: form.indications.trim(),
      costCents,
      priceCents,
      productionDate: hasProduction
        ? `${productionYear}-${String(productionMonth).padStart(2, '0')}${
            productionDay ? `-${String(productionDay).padStart(2, '0')}` : ''
          }`
        : '',
      shelfLifeYears: shelfYears,
      shelfLifeMonths: shelfMonths,
      shelfLifeDays: shelfDays,
      units
    }
    try {
      if (editId) {
        await window.api.drugs.update(editId, input)
        showToast('药品已保存')
        setDirty(false)
        navigate(`/pharmacy/${editId}`)
      } else {
        const result = await window.api.drugs.create(input)
        showToast('药品已添加')
        setDirty(false)
        navigate(`/pharmacy/${result.id}`)
      }
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const back = (): void => {
    if (dirty) setLeaveOpen(true)
    else navigate(backTarget)
  }

  return (
    <div data-testid="drug-edit-page">
      <Breadcrumbs
        items={
          editId
            ? [
                { label: '药房', to: '/pharmacy' },
                { label: form.name || '药品详情', to: `/pharmacy/${editId}` },
                { label: '编辑药品' }
              ]
            : [{ label: '药房', to: '/pharmacy' }, { label: '新建药品' }]
        }
      />
      <PageHeader
        title={editId ? '编辑药品' : '新建药品'}
        actions={
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={back}>
            返回药房
          </Button>
        }
      />

      {loading ? (
        <div className="muted">正在加载药品…</div>
      ) : error ? (
        <div className="inline-error">{error}</div>
      ) : (
        <div style={{ maxWidth: 980 }}>
          <section className="form-section">
            <h2 className="form-section-title">基本信息</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-8">
                <Field label="药品名称" required>
                  <TextInput
                    value={form.name}
                    maxLength={40}
                    placeholder="如：阿莫西林胶囊"
                    data-testid="drug-name"
                    onChange={(event) => setField('name', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-4">
                <Field label="入库日期" required>
                  <TextInput
                    type="date"
                    value={form.inboundDate}
                    data-testid="drug-inbound-date"
                    onChange={(event) => setField('inboundDate', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-4">
                <Field label="单位" required hint="如盒、包、袋、瓶、支、片">
                  <TextInput
                    list="unit-options"
                    value={form.unit}
                    maxLength={8}
                    data-testid="drug-unit"
                    onChange={(event) => setField('unit', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-4">
                <Field label="分类">
                  <TextInput
                    value={form.category}
                    maxLength={50}
                    placeholder="如：抗生素"
                    onChange={(event) => setField('category', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-4">
                <Field label="供应商">
                  <TextInput
                    value={form.supplier}
                    maxLength={50}
                    placeholder="如：华康医药"
                    onChange={(event) => setField('supplier', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="form-section" style={{ marginTop: 16 }}>
            <h2 className="form-section-title">保质期</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-8">
                <Field label="生产日期" required hint="年和月必填，日选填">
                  <div className="flex gap-8">
                    <TextInput
                      type="number"
                      placeholder="年"
                      value={form.productionYear}
                      data-testid="drug-production-year"
                      onChange={(event) => setField('productionYear', event.target.value)}
                    />
                    <TextInput
                      type="number"
                      placeholder="月"
                      min={1}
                      max={12}
                      value={form.productionMonth}
                      data-testid="drug-production-month"
                      onChange={(event) => setField('productionMonth', event.target.value)}
                    />
                    <TextInput
                      type="number"
                      placeholder="日（选填）"
                      min={1}
                      max={31}
                      value={form.productionDay}
                      data-testid="drug-production-day"
                      onChange={(event) => setField('productionDay', event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <div className="span-4">
                <Field label="到期日期">
                  <span className="stock-readonly-value" data-testid="drug-expiry-preview">
                    {expiryPreview || '—'}
                  </span>
                </Field>
              </div>
              <div className="span-12">
                <Field label="保质期" required hint="可组合填写年、月、天">
                  <div className="flex gap-8">
                    <TextInput
                      type="number"
                      min={0}
                      placeholder="年"
                      value={form.shelfYears}
                      data-testid="drug-shelf-years"
                      onChange={(event) => setField('shelfYears', event.target.value)}
                    />
                    <TextInput
                      type="number"
                      min={0}
                      placeholder="月"
                      value={form.shelfMonths}
                      data-testid="drug-shelf-months"
                      onChange={(event) => setField('shelfMonths', event.target.value)}
                    />
                    <TextInput
                      type="number"
                      min={0}
                      placeholder="天"
                      value={form.shelfDays}
                      data-testid="drug-shelf-days"
                      onChange={(event) => setField('shelfDays', event.target.value)}
                    />
                  </div>
                </Field>
              </div>
            </div>
          </section>

          <section className="form-section" style={{ marginTop: 16 }}>
            <h2 className="form-section-title">细分单位（选填）</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              例如：1 盒 = 7 支，1 支 = 20 mg。库存按最细单位扣减。
            </p>
            {subunits.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>细分单位</th>
                      <th>每 1 上级单位包含</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {subunits.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <TextInput
                            value={row.unit}
                            maxLength={8}
                            placeholder="如支、片、mg"
                            data-testid={`drug-subunit-unit-${index}`}
                            onChange={(event) =>
                              setSubunits((current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, unit: event.target.value } : entry
                                )
                              )
                            }
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <TextInput
                              type="number"
                              min={0.0001}
                              step="any"
                              value={row.factor}
                              data-testid={`drug-subunit-factor-${index}`}
                              onChange={(event) =>
                                setSubunits((current) =>
                                  current.map((entry, i) =>
                                    i === index ? { ...entry, factor: event.target.value } : entry
                                  )
                                )
                              }
                            />
                            <span>{row.unit || '单位'} / {index === 0 ? form.unit : subunits[index - 1]?.unit}</span>
                          </div>
                        </td>
                        <td>
                          <Button
                            size="xs"
                            variant="text-danger"
                            onClick={() => setSubunits((current) => current.filter((_, i) => i !== index))}
                          >
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              style={{ marginTop: 10 }}
              data-testid="add-drug-subunit"
              onClick={() =>
                setSubunits((current) => [
                  ...current,
                  { unit: '', factor: '1', price: '0.00', cost: '0.00' }
                ])
              }
            >
              添加细分单位
            </Button>
          </section>

          <section className="form-section" style={{ marginTop: 16 }}>
            <h2 className="form-section-title">库存</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-4">
                <Field label="库存数量" hint="只读显示；需要修改请点盘点校正">
                  <div className="stock-readonly-row">
                    <span className="stock-readonly-value" data-testid="drug-stock-display">
                      {stockLabel}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="stock-adjust-open"
                      onClick={openStockAdjust}
                    >
                      盘点校正
                    </Button>
                  </div>
                </Field>
              </div>
              <div className="span-4">
                <Field label="预警库存" required hint="库存 ≤ 此值时提醒">
                  <TextInput
                    type="number"
                    min={0}
                    step={1}
                    value={form.warningQty}
                    data-testid="drug-warning"
                    onChange={(event) => setField('warningQty', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="form-section" style={{ marginTop: 16 }}>
            <h2 className="form-section-title">其他信息</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-12">
                <Field label="适应症">
                  <TextArea
                    rows={4}
                    maxLength={200}
                    value={form.indications}
                    placeholder="填写适应症，最多 200 字"
                    onChange={(event) => setField('indications', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </section>

          <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="secondary" onClick={back} disabled={saving}>
              取消
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()} data-testid="save-drug">
              保存
            </Button>
          </div>
        </div>
      )}

      <datalist id="unit-options">
        {['盒', '包', '袋', '瓶', '支', '片', '粒', '毫升'].map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      <Dialog
        open={stockOpen}
        title="盘点校正"
        onClose={() => setStockOpen(false)}
        testId="stock-adjust-dialog"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStockOpen(false)}>
              取消
            </Button>
            <Button variant="primary" data-testid="stock-adjust-save" onClick={confirmStockAdjust}>
              保存
            </Button>
          </>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          当前显示：{stockLabel}。请按整数填写整盒和各细分单位零头。
        </p>
        <Field label={`整盒数量（${form.unit || '单位'}）`}>
          <TextInput
            type="number"
            min={0}
            step={1}
            value={stockBaseDraft}
            data-testid="stock-base"
            onChange={(event) => setStockBaseDraft(event.target.value)}
          />
        </Field>
        {subunits.map((row, index) => (
          <Field
            key={index}
            label={`${row.unit || '细分单位'}零头${
              index === 0 ? `（不足1${form.unit || '盒'}）` : `（不足1${subunits[index - 1]?.unit || '单位'}）`
            }`}
          >
            <TextInput
              type="number"
              min={0}
              step={1}
              value={stockLooseDraft[index] ?? '0'}
              data-testid={`stock-loose-${index}`}
              onChange={(event) =>
                setStockLooseDraft((current) =>
                  current.map((value, i) => (i === index ? event.target.value : value))
                )
              }
            />
          </Field>
        ))}
      </Dialog>

      <ConfirmDialog
        open={leaveOpen}
        title="放弃未保存的修改？"
        message="离开后，本次填写的内容不会保留。"
        confirmText="离开"
        cancelText="继续编辑"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false)
          setDirty(false)
          navigate(backTarget)
        }}
        testId="leave-drug-dialog"
      />
    </div>
  )
}
