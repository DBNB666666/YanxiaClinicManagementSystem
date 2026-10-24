import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { DrugInput, DrugUnitInput } from '@shared/types/models'
import { centsToInput, formatCents, toCents } from '@shared/money'
import { todayIso } from '@shared/date'
import { Button, ConfirmDialog, Field, PageHeader, TextArea, TextInput } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'

interface DrugForm {
  name: string
  inboundDate: string
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
  const marginCents = priceCents - costCents
  const marginPercent = priceCents > 0 ? Math.round((marginCents / priceCents) * 100) : 0

  const save = async (): Promise<void> => {
    if (!form.name.trim() || !form.unit.trim()) {
      showToast('请填写药品名称和单位', 'warning')
      return
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
            <h2 className="form-section-title">库存</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-4">
                <Field label="库存数量" required hint="修改库存视为盘点校正">
                  <TextInput
                    type="number"
                    min={0}
                    step={1}
                    value={form.stockQty}
                    data-testid="drug-stock"
                    onChange={(event) => setField('stockQty', event.target.value)}
                  />
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
            <h2 className="form-section-title">细分单位（选填）</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              例如：1 盒 = 7 支，1 支 = 20 mg。每一级单独设置售价和成本；库存按最细单位扣减。
            </p>
            {subunits.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>细分单位</th>
                      <th>每 1 上级单位包含</th>
                      <th>售价（元）</th>
                      <th>成本（元）</th>
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
                          <TextInput
                            value={row.price}
                            inputMode="decimal"
                            data-testid={`drug-subunit-price-${index}`}
                            onChange={(event) =>
                              setSubunits((current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, price: event.target.value } : entry
                                )
                              )
                            }
                          />
                        </td>
                        <td>
                          <TextInput
                            value={row.cost}
                            inputMode="decimal"
                            data-testid={`drug-subunit-cost-${index}`}
                            onChange={(event) =>
                              setSubunits((current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, cost: event.target.value } : entry
                                )
                              )
                            }
                          />
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
            <h2 className="form-section-title">价格</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="span-4">
                <Field label="成本" required>
                  <div className="input-group">
                    <span className="unit">¥</span>
                    <TextInput
                      value={form.cost}
                      inputMode="decimal"
                      data-testid="drug-cost"
                      onChange={(event) => setField('cost', event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <div className="span-4">
                <Field label="标价" required>
                  <div className="input-group">
                    <span className="unit">¥</span>
                    <TextInput
                      value={form.price}
                      inputMode="decimal"
                      data-testid="drug-price"
                      onChange={(event) => setField('price', event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <div className="span-4">
                <Field label="毛利">
                  <div
                    className={`money ${marginCents < 0 ? 'negative' : ''}`.trim()}
                    style={{ height: 36, display: 'flex', alignItems: 'center' }}
                  >
                    {formatCents(marginCents)}（{marginPercent}%）
                  </div>
                </Field>
              </div>
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
