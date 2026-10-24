import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { Drug, Gender, PrescriptionInput, PrescriptionItem } from '@shared/types/models'
import { isApiErrorCode } from '@shared/apiError'
import { centsToInput, formatCents, toCents } from '@shared/money'
import { todayIso } from '@shared/date'
import { mergeUsage } from '@shared/prescriptionUsage'
import { drugUnitChoices, formatDrugStock, type UnitChoice } from '@shared/drugUnits'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  SearchInput,
  TextInput
} from '../../components/Ui'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { useSettings } from '../../context/SettingsProvider'
import { useToast } from '../../context/ToastProvider'

interface EditItem {
  key: string
  id?: number
  drugId: number
  drugName: string
  unit: string
  unitChoices: UnitChoice[]
  baseFactor: number
  qty: number
  usage: string
  frequency: string
  unitPriceCents: number
  unitCostCents: number
  amountCents: number
  stockQty: number
  warningQty: number
}

interface FormState {
  patientName: string
  gender: Gender
  age: string
  diagnosis: string
  issueDate: string
  doctor: string
  injectionFee: string
}

const USAGE_OPTIONS = ['口服', '外用', '注射', '含服', '雾化', '滴眼', '滴耳', '鼻饲']
const FREQUENCY_OPTIONS = ['每日1次', '每日2次', '每日3次', '每晚1次', '必要时', '每8小时1次']

function newKey(): string {
  return Math.random().toString(36).slice(2)
}

function emptyForm(lastDoctor: string): FormState {
  return {
    patientName: '',
    gender: '男',
    age: '',
    diagnosis: '',
    issueDate: todayIso(),
    doctor: lastDoctor,
    injectionFee: '0.00'
  }
}

function mapItem(item: PrescriptionItem, drugs: Drug[]): EditItem {
  const drug = drugs.find((entry) => entry.id === item.drugId)
  const choices = drug
    ? drugUnitChoices(drug)
    : [{ unit: item.unit, factor: 1, priceCents: item.unitPriceCents, costCents: item.unitCostCents }]
  const selected = choices.find((choice) => choice.unit === item.unit) ?? choices[0]
  return {
    key: newKey(),
    id: item.id,
    drugId: item.drugId,
    drugName: item.drugName,
    unit: item.unit,
    unitChoices: choices,
    baseFactor: selected ? 1 / selected.factor : 1,
    qty: item.qty,
    usage: mergeUsage(item.usage, item.frequency),
    frequency: '',
    unitPriceCents: item.unitPriceCents,
    unitCostCents: item.unitCostCents,
    amountCents: item.amountCents,
    stockQty: drug?.stockQty ?? 0,
    warningQty: drug?.warningQty ?? 0
  }
}

export function PrescriptionEditPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings, setLastDoctor, setSignatureImage } = useSettings()
  const { showToast } = useToast()
  const editId = id ? Number(id) : null
  const backTarget = editId ? `/prescriptions/${editId}` : '/prescriptions'
  const draftKey = `yanxia:rx-draft:${editId ?? 'new'}`
  const [form, setForm] = useState<FormState>(emptyForm(settings.lastDoctor))
  const [items, setItems] = useState<EditItem[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set())
  const [manualAmount, setManualAmount] = useState<number | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [pendingInput, setPendingInput] = useState<PrescriptionInput | null>(null)
  const [pendingPrint, setPendingPrint] = useState(false)
  const [stockDialog, setStockDialog] = useState<string[]>([])
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [signatureBusy, setSignatureBusy] = useState(false)
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<() => void>(() => undefined)

  const uploadSignature = (file: File | undefined): void => {
    if (!file) return
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      showToast('签名图只支持 PNG/JPEG', 'warning')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('签名图不能超过 2MB', 'warning')
      return
    }
    setSignatureBusy(true)
    const reader = new FileReader()
    reader.onload = () => {
      void setSignatureImage(String(reader.result))
        .then(() => showToast('签名图已保存到本机数据'))
        .catch((cause: Error) => showToast(cause.message, 'error'))
        .finally(() => setSignatureBusy(false))
    }
    reader.onerror = () => {
      setSignatureBusy(false)
      showToast('读取签名图失败', 'error')
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const [active, stopped] = await Promise.all([
          window.api.drugs.list({ page: 1, pageSize: 100 }),
          window.api.drugs.list({ filter: 'stopped', page: 1, pageSize: 100 })
        ])
        const allDrugs = [...active.items, ...stopped.items]
        if (cancelled) return
        setDrugs(allDrugs)
        if (editId) {
          const detail = await window.api.prescriptions.get(editId)
          if (cancelled) return
          setForm({
            patientName: detail.patientName,
            gender: detail.gender,
            age: detail.age,
            diagnosis: detail.diagnosis,
            issueDate: detail.issueDate,
            doctor: detail.doctor,
            injectionFee: centsToInput(detail.injectionFeeCents)
          })
          const mapped = detail.items.map((item) => mapItem(item, allDrugs))
          setItems(mapped)
          const automatic = mapped.reduce((sum, item) => sum + item.amountCents, 0)
          if (detail.drugAmountCents !== automatic) {
            setManualAmount(detail.drugAmountCents)
            setManualInput(centsToInput(detail.drugAmountCents))
          }
        } else {
          setForm(emptyForm(settings.lastDoctor))
        }
        let restoredDraft = false
        try {
          const rawDraft = sessionStorage.getItem(draftKey)
          if (rawDraft) {
            const draft = JSON.parse(rawDraft) as {
              form: FormState
              items: EditItem[]
              manualAmount: number | null
              manualInput: string
            }
            setForm(draft.form)
            setItems(draft.items)
            setManualAmount(draft.manualAmount)
            setManualInput(draft.manualInput)
            restoredDraft = true
          }
        } catch {
          // 草稿损坏时使用已保存数据
        }
        setDirty(restoredDraft)
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!editId && !dirty && !form.doctor && settings.lastDoctor) {
      setForm((current) => ({ ...current, doctor: settings.lastDoctor }))
    }
  }, [settings.lastDoctor, editId, dirty, form.doctor])

  useEffect(() => {
    if (!dirty) return
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ form, items, manualAmount, manualInput })
      )
    } catch {
      // 草稿写入失败不影响继续编辑
    }
  }, [dirty, draftKey, form, items, manualAmount, manualInput])

  const automaticAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.amountCents, 0),
    [items]
  )
  const drugAmountCents = manualAmount ?? automaticAmount
  const injectionFeeCents = useMemo(() => {
    try {
      return toCents(form.injectionFee || '0')
    } catch {
      return 0
    }
  }, [form.injectionFee])
  const totalCents = drugAmountCents + injectionFeeCents

  const stockWarnings = useMemo(
    () =>
      items
        .filter((item) => item.qty > item.stockQty)
        .map((item) => `${item.drugName}：需要 ${item.qty}${item.unit}，当前 ${item.stockQty}${item.unit}`),
    [items]
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const updateItem = (key: string, patch: Partial<EditItem>): void => {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item
        const next = { ...item, ...patch }
        if (patch.unit !== undefined) {
          const choice = next.unitChoices.find((entry) => entry.unit === patch.unit)
          if (choice) {
            next.unitPriceCents = choice.priceCents
            next.unitCostCents = choice.costCents
            next.baseFactor = 1 / choice.factor
          }
        }
        next.amountCents = next.qty * next.unitPriceCents
        return next
      })
    )
    setDirty(true)
  }

  const removeItem = (key: string): void => {
    setItems((current) => current.filter((item) => item.key !== key))
    setDirty(true)
  }

  const openPicker = (): void => {
    setPickerQuery('')
    setPickerSelected(new Set())
    setPickerOpen(true)
  }

  const pickerDrugs = useMemo(() => {
    const keyword = pickerQuery.trim()
    return drugs
      .filter((drug) => drug.status === 'active')
      .filter((drug) => !keyword || drug.name.includes(keyword) || drug.category.includes(keyword))
      .slice(0, 50)
  }, [drugs, pickerQuery])

  const addSelected = (): void => {
    const chosen = drugs.filter((drug) => pickerSelected.has(drug.id))
    const existing = new Set(items.map((item) => item.drugId))
    const next = chosen
      .filter((drug) => !existing.has(drug.id))
      .map<EditItem>((drug) => ({
        key: newKey(),
        drugId: drug.id,
        drugName: drug.name,
        unit: drug.unit,
        unitChoices: drugUnitChoices(drug),
        baseFactor: 1,
        qty: 1,
        usage: '',
        frequency: '',
        unitPriceCents: drug.priceCents,
        unitCostCents: drug.costCents,
        amountCents: drug.priceCents,
        stockQty: drug.stockQty,
        warningQty: drug.warningQty
      }))
    setItems((current) => [...current, ...next])
    setPickerOpen(false)
    setDirty(true)
  }

  const buildInput = (): PrescriptionInput => ({
    patientName: form.patientName.trim(),
    gender: form.gender,
    age: form.age.trim(),
    diagnosis: form.diagnosis.trim(),
    issueDate: form.issueDate,
    doctor: form.doctor.trim(),
    items: items.map((item) => ({
      id: item.id,
      drugId: item.drugId,
      unit: item.unit,
      qty: item.qty,
      usage: item.usage,
      frequency: ''
    })),
    injectionFeeCents,
    manualDrugAmountCents: manualAmount
  })

  const persist = async (input: PrescriptionInput, allowNegativeStock: boolean, print: boolean): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const result = editId
        ? await window.api.prescriptions.update(editId, input, allowNegativeStock)
        : await window.api.prescriptions.create(input, allowNegativeStock)
      try {
        await setLastDoctor(form.doctor.trim())
      } catch {
        // 偏好保存失败不影响处方已保存的事实
      }
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
      setDirty(false)
      showToast(editId ? '处方已保存，库存已扣减' : '处方已保存')
      if (print) {
        navigate(`/prescriptions/print?ids=${result.id}`)
      } else {
        navigate('/prescriptions')
      }
    } catch (cause) {
      if (isApiErrorCode(cause, 'STOCK_INSUFFICIENT') && !allowNegativeStock) {
        const error = cause as { message: string; details?: unknown }
        const details = Array.isArray(error.details) ? error.details.map(String) : [error.message]
        setPendingInput(input)
        setPendingPrint(print)
        setStockDialog(details)
      } else {
        showToast((cause as Error).message, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSave = (print = false): void => {
    const input = buildInput()
    if (!input.patientName || !input.age || !input.diagnosis || !input.doctor) {
      showToast('请把患者信息和医师填写完整', 'warning')
      return
    }
    if (input.items.length === 0) {
      showToast('请至少添加一种药品', 'warning')
      return
    }
    void persist(input, false, print)
  }

  saveRef.current = () => handleSave(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const confirmStockSave = (): void => {
    if (!pendingInput) return
    const input = pendingInput
    const print = pendingPrint
    setPendingInput(null)
    setStockDialog([])
    void persist(input, true, print)
  }

  const requestBack = (): void => {
    if (dirty) setLeaveOpen(true)
    else navigate(backTarget)
  }

  if (loading) {
    return <div className="muted">正在加载处方…</div>
  }

  return (
    <div data-testid="prescription-edit-page">
      <Breadcrumbs
        items={
          editId
            ? [
                { label: '处方', to: '/prescriptions' },
                {
                  label: form.patientName || '处方详情',
                  to: `/prescriptions/${editId}`
                },
                { label: '编辑处方' }
              ]
            : [{ label: '处方', to: '/prescriptions' }, { label: '新建处方' }]
        }
      />
      <div className="page-head">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={requestBack}>
          返回处方
        </Button>
        <div className="title-block">
          <h1 className="page-title">{editId ? '编辑处方' : '新建处方'}</h1>
        </div>
      </div>

      {error ? <div className="inline-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="edit-layout">
        <div className="edit-main">
          <section className="form-section">
            <div className="form-section-head">
              <h2 className="form-section-title">患者信息</h2>
            </div>
            <div className="form-grid">
              <div className="span-3">
                <Field label="姓名" required>
                  <TextInput
                    value={form.patientName}
                    maxLength={20}
                    placeholder="患者姓名"
                    data-testid="rx-patient-name"
                    onChange={(event) => setField('patientName', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-3">
                <Field label="性别" required>
                  <div className="segmented">
                    {(['男', '女'] as Gender[]).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        className={`seg-btn ${form.gender === gender ? 'active' : ''}`.trim()}
                        data-testid={`rx-gender-${gender}`}
                        onClick={() => setField('gender', gender)}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="span-3">
                <Field label="年龄" required hint="可填 62 或 8个月">
                  <TextInput
                    value={form.age}
                    maxLength={10}
                    placeholder="如 62 / 8个月"
                    data-testid="rx-age"
                    onChange={(event) => setField('age', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-3">
                <Field label="开具日期" required>
                  <TextInput
                    type="date"
                    value={form.issueDate}
                    data-testid="rx-date"
                    onChange={(event) => setField('issueDate', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-8">
                <Field label="临床诊断" required>
                  <TextInput
                    value={form.diagnosis}
                    maxLength={100}
                    placeholder="如：高血压、失眠"
                    data-testid="rx-diagnosis"
                    onChange={(event) => setField('diagnosis', event.target.value)}
                  />
                </Field>
              </div>
              <div className="span-4">
                <Field label="医师" required>
                  <TextInput
                    value={form.doctor}
                    maxLength={20}
                    placeholder="医师姓名"
                    data-testid="rx-doctor"
                    onChange={(event) => setField('doctor', event.target.value)}
                  />
                  <div className="doctor-signature-row">
                    {settings.signatureImage ? (
                      <img
                        className="signature-thumb"
                        src={settings.signatureImage}
                        alt="医师签名预览"
                        data-testid="signature-preview"
                      />
                    ) : (
                      <span className="field-hint">可上传签名图，打印时放在用药右下侧</span>
                    )}
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      hidden
                      data-testid="signature-upload"
                      onChange={(event) => {
                        uploadSignature(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      loading={signatureBusy}
                      onClick={() => signatureInputRef.current?.click()}
                    >
                      {settings.signatureImage ? '更换签名图' : '上传签名图'}
                    </Button>
                    {settings.signatureImage ? (
                      <Button
                        size="xs"
                        variant="text-danger"
                        onClick={() => {
                          void setSignatureImage('').catch((cause: Error) =>
                            showToast(cause.message, 'error')
                          )
                        }}
                      >
                        清除
                      </Button>
                    ) : null}
                  </div>
                </Field>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2 className="form-section-title">用药</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                共 {items.length} 种
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={15} />}
                style={{ marginLeft: 'auto' }}
                onClick={openPicker}
                data-testid="add-medication"
              >
                添加用药
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="med-empty">
                还没有添加药品。
                <Button variant="ghost" size="sm" onClick={openPicker}>
                  从药房添加
                </Button>
              </div>
            ) : (
              <table className="med-table" data-testid="medication-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>药品</th>
                    <th style={{ width: '24%' }}>数量</th>
                    <th style={{ width: '34%' }}>用法</th>
                    <th style={{ width: '12%' }} className="right">
                      金额
                    </th>
                    <th style={{ width: '7%' }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <div className="med-drug-name">{item.drugName}</div>
                        <div
                          className={`med-drug-stock ${
                            item.stockQty <= item.warningQty ? 'low' : ''
                          }`.trim()}
                        >
                          库存{' '}
                          {formatDrugStock({
                            unit: item.unitChoices[0]?.unit ?? item.unit,
                            stockQty: item.stockQty,
                            units: item.unitChoices.slice(1).map((choice) => ({
                              id: 0,
                              unit: choice.unit,
                              factor: choice.factor,
                              priceCents: choice.priceCents,
                              costCents: choice.costCents
                            }))
                          })}{' '}
                          · 预警 {item.warningQty}
                          {item.unitChoices[0]?.unit ?? item.unit}
                        </div>
                      </td>
                      <td>
                        <div className="med-qty">
                          <input
                            className="input"
                            type="number"
                            min={1}
                            step={1}
                            value={item.qty}
                            data-testid={`med-qty-${item.drugId}`}
                            onChange={(event) =>
                              updateItem(item.key, {
                                qty: Math.max(1, Math.floor(Number(event.target.value) || 1))
                              })
                            }
                          />
                          <span
                            className="med-unit"
                            data-testid={`med-unit-label-${item.drugId}`}
                          >
                            {item.unit}
                          </span>
                          {item.unitChoices.length > 1 ? (
                            <select
                              className="select med-unit-select"
                              value={item.unit}
                              aria-label="选择用药单位"
                              data-testid={`med-unit-${item.drugId}`}
                              onChange={(event) => updateItem(item.key, { unit: event.target.value })}
                            >
                              {item.unitChoices.map((choice) => (
                                <option key={choice.unit} value={choice.unit}>
                                  {choice.unit}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <input
                          className="input"
                          list="usage-options"
                          value={item.usage}
                          placeholder="如：口服，每日3次"
                          data-testid={`med-usage-${item.drugId}`}
                          onChange={(event) => updateItem(item.key, { usage: event.target.value })}
                        />
                      </td>
                      <td className="right money">{formatCents(item.amountCents)}</td>
                      <td>
                        <IconButton label={`移除 ${item.drugName}`} danger onClick={() => removeItem(item.key)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <datalist id="usage-options">
              {[...USAGE_OPTIONS, ...FREQUENCY_OPTIONS].map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </section>
        </div>

        <aside className="edit-side">
          <div className="fee-panel">
            <div className="fee-row">
              <span className="fee-label">药品金额</span>
              {manualAmount == null ? (
                <span className="fee-value" data-testid="rx-drug-amount">
                  {formatCents(drugAmountCents)}
                </span>
              ) : (
                <span className="flex gap-4">
                  <TextInput
                    style={{ width: 100, height: 30 }}
                    value={manualInput}
                    inputMode="decimal"
                    onChange={(event) => {
                      setManualInput(event.target.value)
                      try {
                        setManualAmount(toCents(event.target.value))
                      } catch {
                        // 保持上一次有效值
                      }
                      setDirty(true)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setManualAmount(null)
                      setManualInput('')
                    }}
                  >
                    恢复自动
                  </Button>
                </span>
              )}
            </div>
            {manualAmount == null ? (
              <div style={{ textAlign: 'right' }}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setManualAmount(automaticAmount)
                    setManualInput(centsToInput(automaticAmount))
                  }}
                >
                  手动调整
                </Button>
              </div>
            ) : null}
            <div className="fee-row">
              <span className="fee-label">注射费</span>
              <TextInput
                style={{ width: 110 }}
                value={form.injectionFee}
                inputMode="decimal"
                data-testid="rx-injection-fee"
                onChange={(event) => setField('injectionFee', event.target.value)}
              />
            </div>
            <div className="fee-row fee-total">
              <span>应收合计</span>
              <span className="fee-value" data-testid="rx-total">
                {formatCents(totalCents)}
              </span>
            </div>
          </div>

          <div className="form-section">
            <h2 className="detail-panel-title" style={{ fontSize: 14 }}>
              库存提示
            </h2>
            {stockWarnings.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                所选药品库存充足
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stockWarnings.map((warning) => (
                  <div key={warning} className="warning-text" style={{ fontSize: 13 }}>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="edit-footer">
        <span className="fee-mini">
          应收合计 <strong>{formatCents(totalCents)}</strong>
        </span>
        <div className="edit-footer-actions">
          <Button variant="secondary" onClick={requestBack} disabled={saving}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => handleSave(true)} loading={saving} data-testid="save-print">
            保存并打印
          </Button>
          <Button variant="primary" onClick={() => handleSave(false)} loading={saving} data-testid="save-prescription">
            保存
          </Button>
        </div>
      </div>

      <Dialog
        open={pickerOpen}
        title="添加用药"
        onClose={() => setPickerOpen(false)}
        testId="drug-picker"
        footer={
          <div className="drug-picker-footer" style={{ width: '100%' }}>
            <span className="selected-count">已选 {pickerSelected.size} 种</span>
            <div className="actions">
              <Button variant="secondary" onClick={() => setPickerOpen(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={addSelected}
                disabled={pickerSelected.size === 0}
                data-testid="confirm-add-medications"
              >
                添加 {pickerSelected.size || ''} 种
              </Button>
            </div>
          </div>
        }
      >
        <SearchInput
          value={pickerQuery}
          onChange={setPickerQuery}
          placeholder="搜索药品名称 / 分类"
          testId="drug-picker-search"
        />
        <div className="med-picker-results">
          {pickerDrugs.length === 0 ? (
            <div className="picker-empty">没有找到可添加的药品</div>
          ) : (
            pickerDrugs.map((drug) => {
              const exists = items.some((item) => item.drugId === drug.id)
              const checked = pickerSelected.has(drug.id)
              return (
                <label
                  key={drug.id}
                  className={`med-picker-row ${exists ? 'disabled' : ''}`.trim()}
                  data-testid={`drug-option-${drug.id}`}
                >
                  <input
                    type="checkbox"
                    className="checkbox"
                    disabled={exists}
                    checked={checked}
                    onChange={() => {
                      setPickerSelected((current) => {
                        const next = new Set(current)
                        if (next.has(drug.id)) next.delete(drug.id)
                        else next.add(drug.id)
                        return next
                      })
                    }}
                  />
                  <span className="med-picker-main">
                    <span className="med-picker-name">{drug.name}</span>
                    <span className="med-picker-meta">
                      {exists ? '已添加 · ' : ''}库存 {drug.stockQty} {drug.unit} · {drug.category || '未分类'}
                    </span>
                  </span>
                  <span className="med-picker-price">{formatCents(drug.priceCents)}</span>
                </label>
              )
            })
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={stockDialog.length > 0}
        title="库存不足"
        message={
          <div>
            {stockDialog.map((line) => (
              <div key={line}>{line}</div>
            ))}
            <div style={{ marginTop: 8 }}>保存后库存会变为负数，之后可以通过进货补回。</div>
          </div>
        }
        confirmText="仍然保存"
        cancelText="返回修改"
        onCancel={() => {
          setPendingInput(null)
          setStockDialog([])
        }}
        onConfirm={confirmStockSave}
        testId="stock-confirm-dialog"
      />

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
        testId="leave-confirm-dialog"
      />
    </div>
  )
}
