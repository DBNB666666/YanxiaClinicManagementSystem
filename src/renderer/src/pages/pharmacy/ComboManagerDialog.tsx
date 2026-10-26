import { useEffect, useState } from 'react'
import type { Drug, MedicationCombo, MedicationComboInput } from '@shared/types/models'
import { drugUnitChoices } from '@shared/drugUnits'
import { Button, Dialog, IconButton, Select, TextInput } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'
import { Plus, Trash2 } from 'lucide-react'

interface ComboItemForm {
  drugId: number
  qty: string
  unit: string
}

interface ComboForm {
  id?: number
  name: string
  items: ComboItemForm[]
}

const EMPTY_FORM: ComboForm = { name: '', items: [] }

export function ComboManagerDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { showToast } = useToast()
  const [combos, setCombos] = useState<MedicationCombo[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ComboForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const [comboList, activeDrugs, stoppedDrugs] = await Promise.all([
        window.api.combos.list(),
        window.api.drugs.list({ page: 1, pageSize: 100 }),
        window.api.drugs.list({ filter: 'stopped', page: 1, pageSize: 100 })
      ])
      setCombos(comboList)
      setDrugs([...activeDrugs.items, ...stoppedDrugs.items])
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setForm(null)
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startCreate = (): void => {
    setForm({ ...EMPTY_FORM, items: [{ drugId: 0, qty: '1', unit: '' }] })
  }

  const startEdit = (combo: MedicationCombo): void => {
    setForm({
      id: combo.id,
      name: combo.name,
      items: combo.items.map((item) => ({
        drugId: item.drugId,
        qty: String(item.qty),
        unit: item.unit
      }))
    })
  }

  const save = async (): Promise<void> => {
    if (!form) return
    if (!form.name.trim()) {
      showToast('请填写组合名称', 'warning')
      return
    }
    if (form.items.length === 0 || form.items.some((item) => !item.drugId || !item.qty)) {
      showToast('请至少添加一种药品并填写数量', 'warning')
      return
    }
    const input: MedicationComboInput = {
      name: form.name.trim(),
      items: form.items.map((item) => ({
        drugId: item.drugId,
        qty: Number(item.qty),
        unit: item.unit
      }))
    }
    setSaving(true)
    try {
      if (form.id) await window.api.combos.update(form.id, input)
      else await window.api.combos.create(input)
      showToast(form.id ? '组合已更新' : '组合已添加')
      setForm(null)
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (combo: MedicationCombo): Promise<void> => {
    try {
      await window.api.combos.remove(combo.id)
      showToast('组合已删除')
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    }
  }

  const drugFor = (drugId: number): Drug | undefined => drugs.find((drug) => drug.id === drugId)

  return (
    <Dialog
      open={open}
      title="用药组合"
      onClose={onClose}
      testId="combo-manager-dialog"
      footer={
        form ? (
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
              取消
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()} data-testid="save-combo">
              保存组合
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              关闭
            </Button>
            <Button variant="primary" onClick={startCreate} data-testid="new-combo">
              新建组合
            </Button>
          </>
        )
      }
    >
      {form ? (
        <div>
          <Field label="组合名称" required>
            <TextInput
              value={form.name}
              maxLength={40}
              data-testid="combo-name"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>药品</th>
                  <th>数量</th>
                  <th>单位</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, index) => {
                  const drug = drugFor(item.drugId)
                  const choices = drug ? drugUnitChoices(drug) : []
                  return (
                    <tr key={index}>
                      <td>
                        <Select
                          value={item.drugId || ''}
                          data-testid={`combo-drug-${index}`}
                          onChange={(event) => {
                            const drugId = Number(event.target.value)
                            const selectedDrug = drugFor(drugId)
                            const nextUnit = selectedDrug?.unit ?? ''
                            setForm({
                              ...form,
                              items: form.items.map((entry, i) =>
                                i === index ? { ...entry, drugId, unit: nextUnit } : entry
                              )
                            })
                          }}
                        >
                          <option value="">选择药品</option>
                          {drugs.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <TextInput
                          type="number"
                          min={1}
                          value={item.qty}
                          data-testid={`combo-qty-${index}`}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              items: form.items.map((entry, i) =>
                                i === index ? { ...entry, qty: event.target.value } : entry
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <Select
                          value={item.unit}
                          data-testid={`combo-unit-${index}`}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              items: form.items.map((entry, i) =>
                                i === index ? { ...entry, unit: event.target.value } : entry
                              )
                            })
                          }
                        >
                          {choices.map((choice) => (
                            <option key={choice.unit} value={choice.unit}>
                              {choice.unit}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <IconButton
                          label="移除药品"
                          danger
                          onClick={() =>
                            setForm({
                              ...form,
                              items: form.items.filter((_, i) => i !== index)
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Button
            variant="secondary"
            size="sm"
            style={{ marginTop: 10 }}
            data-testid="combo-add-item"
            onClick={() =>
              setForm({ ...form, items: [...form.items, { drugId: 0, qty: '1', unit: '' }] })
            }
          >
            <Plus size={15} /> 添加药品
          </Button>
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="muted">正在加载组合…</div>
          ) : combos.length === 0 ? (
            <div className="muted">还没有用药组合。点“新建组合”添加。</div>
          ) : (
            <div className="combo-list">
              {combos.map((combo) => (
                <div className="combo-card" key={combo.id} data-testid={`combo-${combo.id}`}>
                  <div>
                    <div className="combo-name">{combo.name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {combo.items
                        .map((item) => `${item.drugName} ${item.qty}${item.unit}`)
                        .join('、')}
                    </div>
                  </div>
                  <div className="combo-actions">
                    <Button size="xs" variant="ghost" onClick={() => startEdit(combo)}>
                      编辑
                    </Button>
                    <Button size="xs" variant="text-danger" onClick={() => void remove(combo)}>
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function Field({
  label,
  required,
  children
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      <span className="field-label">
        {label}
        {required ? <span className="required">*</span> : null}
      </span>
      {children}
    </label>
  )
}
