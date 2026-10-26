import type {
  Drug,
  DrugDetail,
  DrugInput,
  DrugListQuery,
  DrugUnit,
  DrugUnitInput,
  FinanceDetails,
  FinanceDetailsQuery,
  FinanceQuery,
  FinanceResult,
  FinanceRow,
  FinanceSummary,
  Gender,
  ListResult,
  MedicationCombo,
  MedicationComboInput,
  Notification,
  PrescriptionDetail,
  PrescriptionInput,
  PrescriptionItem,
  PrescriptionListQuery,
  PrescriptionSaveResult,
  PrescriptionSummary,
  Purchase,
  PurchaseInput,
  Settings
} from '../../shared/types/models'
import { AppError } from '../../shared/result'
import { formatCents, multiplyCents } from '../../shared/money'
import { getGroupLabel, getPeriodRange, nowIso, formatDateTime } from '../../shared/date'
import { formatDrugStock, totalUnitFactor } from '../../shared/drugUnits'
import { computeExpiryDate, isExpiryWarning } from '../../shared/expiry'
import {
  drugInputSchema,
  drugListQuerySchema,
  financeDetailsQuerySchema,
  financeQuerySchema,
  idSchema,
  medicationComboInputSchema,
  prescriptionInputSchema,
  prescriptionListQuerySchema,
  purchaseInputSchema,
  settingsPatchSchema
} from '../../shared/validation'
import type { SqliteStore } from '../db/store'

interface DrugRow {
  id: number
  name: string
  unit: string
  inbound_date: string
  production_date: string
  shelf_life_years: number
  shelf_life_months: number
  shelf_life_days: number
  expiry_date: string
  expiry_ack_date: string
  stock_qty: number
  stock_units: number
  warning_qty: number
  category: string
  supplier: string
  indications: string
  cost_cents: number
  price_cents: number
  status: 'active' | 'stopped'
  is_common: number
  created_at: string
  updated_at: string
  usage_count: number
}

interface DrugUnitRow {
  id: number
  drug_id: number
  unit: string
  factor: number
  price_cents: number
  cost_cents: number
  sort_order: number
}

interface PurchaseRow {
  id: number
  drug_id: number
  purchase_date: string
  qty: number
  unit_cost_cents: number
  total_cents: number
  created_at: string
}

interface ComboRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

interface ComboItemRow {
  id: number
  combo_id: number
  drug_id: number
  qty: number
  unit: string
  drug_name: string
  sort_order: number
}

interface PrescriptionRow {
  id: number
  patient_name: string
  gender: Gender
  age: string
  diagnosis: string
  issue_date: string
  rp: string
  doctor: string
  drug_amount_cents: number
  injection_fee_cents: number
  fee_cents: number
  total_cents: number
  created_at: string
  updated_at: string
  cost_cents?: number
  medication_text?: string
}

interface PrescriptionItemRow {
  id: number
  prescription_id: number
  drug_id: number
  drug_name: string
  unit: string
  unit_factor: number
  qty: number
  usage: string
  frequency: string
  group_key: string
  group_name: string
  group_usage: string
  unit_price_cents: number
  unit_cost_cents: number
  amount_cents: number
}

interface NotificationRow {
  id: number
  drug_id: number
  drug_name: string
  stock_qty: number
  warning_qty: number
  expiry_date: string
  reason: string
  created_at: string
  read_at: string | null
}

interface SettingsRow {
  key: string
  value: string
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  lastDoctor: '',
  viewModes: { prescriptions: 'card', pharmacy: 'card' },
  lastExportDir: '',
  signatureImage: '',
  signatureX: 0.675,
  signatureY: 0.744,
  signatureWidth: 0.28
}

function mapDrugUnit(row: DrugUnitRow): DrugUnit {
  return {
    id: Number(row.id),
    unit: row.unit,
    factor: Number(row.factor),
    priceCents: Number(row.price_cents),
    costCents: Number(row.cost_cents)
  }
}

function mapDrug(row: DrugRow, units: DrugUnitRow[] = []): Drug {
  return {
    id: Number(row.id),
    name: row.name,
    unit: row.unit,
    units: units.map(mapDrugUnit),
    inboundDate: row.inbound_date,
    productionDate: row.production_date ?? '',
    shelfLifeYears: Number(row.shelf_life_years ?? 0),
    shelfLifeMonths: Number(row.shelf_life_months ?? 0),
    shelfLifeDays: Number(row.shelf_life_days ?? 0),
    expiryDate: row.expiry_date ?? '',
    expiryAckDate: row.expiry_ack_date ?? '',
    expiring: isExpiryWarning(row.expiry_date ?? '', row.expiry_ack_date ?? ''),
    isCommon: Boolean(row.is_common),
    stockQty: Number(row.stock_qty),
    stockUnits: Number(row.stock_units ?? 0),
    warningQty: Number(row.warning_qty),
    category: row.category,
    supplier: row.supplier,
    indications: row.indications,
    costCents: Number(row.cost_cents),
    priceCents: Number(row.price_cents),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: Number(row.usage_count ?? 0)
  }
}

function mapPurchase(row: PurchaseRow): Purchase {
  return {
    id: Number(row.id),
    drugId: Number(row.drug_id),
    purchaseDate: row.purchase_date,
    qty: Number(row.qty),
    unitCostCents: Number(row.unit_cost_cents),
    totalCents: Number(row.total_cents),
    createdAt: row.created_at
  }
}

function mapItem(row: PrescriptionItemRow): PrescriptionItem {
  return {
    id: Number(row.id),
    prescriptionId: Number(row.prescription_id),
    drugId: Number(row.drug_id),
    drugName: row.drug_name,
    unit: row.unit,
    unitFactor: Number(row.unit_factor ?? 1),
    qty: Number(row.qty),
    usage: row.usage,
    frequency: row.frequency,
    groupKey: row.group_key ?? '',
    groupName: row.group_name ?? '',
    groupUsage: row.group_usage ?? '',
    unitPriceCents: Number(row.unit_price_cents),
    unitCostCents: Number(row.unit_cost_cents),
    amountCents: Number(row.amount_cents)
  }
}

function mapSummary(row: PrescriptionRow): PrescriptionSummary {
  return {
    id: Number(row.id),
    patientName: row.patient_name,
    gender: row.gender,
    age: row.age,
    diagnosis: row.diagnosis,
    issueDate: row.issue_date,
    rp: row.rp,
    doctor: row.doctor,
    drugAmountCents: Number(row.drug_amount_cents),
    injectionFeeCents: Number(row.injection_fee_cents),
    feeCents: Number(row.fee_cents ?? row.total_cents),
    totalCents: Number(row.total_cents),
    costCents: Number(row.cost_cents ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    medicationText: row.medication_text ?? ''
  }
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: Number(row.id),
    drugId: Number(row.drug_id),
    drugName: row.drug_name,
    stockQty: Number(row.stock_qty),
    warningQty: Number(row.warning_qty),
    expiryDate: row.expiry_date ?? '',
    reason: row.reason,
    createdAt: row.created_at,
    readAt: row.read_at
  }
}

function localDateOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export class ClinicService {
  constructor(
    private readonly store: SqliteStore,
    private readonly onDataChanged?: () => void
  ) {}

  // ---------- 药品 ----------

  listDrugs(rawQuery: DrugListQuery): ListResult<Drug> {
    const query = drugListQuerySchema.parse(rawQuery ?? {})
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: string[] = []
    const params: (string | number)[] = []

    if (query.filter === 'low') {
      where.push("d.status = 'active' AND d.stock_qty <= d.warning_qty")
    } else if (query.filter === 'common') {
      where.push("d.status = 'active' AND d.is_common = 1")
    } else if (query.filter === 'stopped') {
      where.push("d.status = 'stopped'")
    } else {
      where.push("d.status = 'active'")
    }

    if (query.query) {
      where.push('(d.name LIKE ? OR d.category LIKE ? OR d.supplier LIKE ?)')
      const like = `%${query.query}%`
      params.push(like, like, like)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = this.store.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM drugs d ${whereSql}`,
      params
    )
    const rows = this.store.queryAll<DrugRow>(
      `SELECT d.*,
        (SELECT COUNT(DISTINCT p.id)
           FROM prescription_items i
           JOIN prescriptions p ON p.id = i.prescription_id
          WHERE i.drug_id = d.id) AS usage_count
       FROM drugs d ${whereSql}
       ORDER BY d.inbound_date DESC, d.name ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    )
    return {
      items: rows.map((row) => mapDrug(row, this.getDrugUnits(Number(row.id)))),
      total: Number(totalRow?.total ?? 0)
    }
  }

  getDrug(id: number): DrugDetail {
    const safeId = idSchema.parse(id)
    const row = this.store.queryOne<DrugRow>(
      `SELECT d.*,
        (SELECT COUNT(DISTINCT p.id)
           FROM prescription_items i
           JOIN prescriptions p ON p.id = i.prescription_id
          WHERE i.drug_id = d.id) AS usage_count
       FROM drugs d WHERE d.id = ?`,
      [safeId]
    )
    if (!row) throw new AppError('NOT_FOUND', '药品不存在')
    const purchases = this.store.queryAll<PurchaseRow>(
      'SELECT * FROM purchases WHERE drug_id = ? ORDER BY purchase_date DESC, id DESC',
      [safeId]
    )
    return {
      ...mapDrug(row, this.getDrugUnits(safeId)),
      purchases: purchases.map(mapPurchase)
    }
  }

  createDrug(input: DrugInput): { id: number } {
    const drug = drugInputSchema.parse(input)
    const now = nowIso()
    const units = drug.units ?? []
    const stockUnits = Math.round(drug.stockQty * totalUnitFactor(units))
    const productionDate = drug.productionDate ?? ''
    const shelfLife = {
      years: drug.shelfLifeYears ?? 0,
      months: drug.shelfLifeMonths ?? 0,
      days: drug.shelfLifeDays ?? 0
    }
    const expiryDate = computeExpiryDate(productionDate, shelfLife)
    const id = this.store.insert(
      `INSERT INTO drugs
        (name, unit, inbound_date, production_date, shelf_life_years, shelf_life_months,
         shelf_life_days, expiry_date, expiry_ack_date, stock_qty, stock_units, warning_qty,
         category, supplier, indications, cost_cents, price_cents, is_common, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        drug.name,
        drug.unit,
        drug.inboundDate,
        productionDate,
        shelfLife.years,
        shelfLife.months,
        shelfLife.days,
        expiryDate,
        drug.stockQty,
        stockUnits,
        drug.warningQty,
        drug.category,
        drug.supplier,
        drug.indications,
        drug.costCents,
        drug.priceCents,
        drug.isCommon ? 1 : 0,
        now,
        now
      ]
    )
    this.saveDrugUnits(id, units)
    this.syncDrugNotification(id)
    this.syncExpiryNotification(id)
    this.onDataChanged?.()
    return { id }
  }

  updateDrug(id: number, input: DrugInput): { id: number } {
    const safeId = idSchema.parse(id)
    const drug = drugInputSchema.parse(input)
    const existing = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [safeId])
    if (!existing) throw new AppError('NOT_FOUND', '药品不存在')
    const units = drug.units ?? this.getDrugUnits(safeId)
    const stockUnits = Math.round(drug.stockQty * totalUnitFactor(units))
    const productionDate = drug.productionDate ?? ''
    const shelfLife = {
      years: drug.shelfLifeYears ?? 0,
      months: drug.shelfLifeMonths ?? 0,
      days: drug.shelfLifeDays ?? 0
    }
    const expiryDate = computeExpiryDate(productionDate, shelfLife)
    const expiryAckDate =
      expiryDate && expiryDate === existing.expiry_date
        ? drug.expiryAckDate ?? existing.expiry_ack_date
        : ''
    this.store.run(
      `UPDATE drugs SET name = ?, unit = ?, inbound_date = ?, production_date = ?,
         shelf_life_years = ?, shelf_life_months = ?, shelf_life_days = ?, expiry_date = ?,
         expiry_ack_date = ?, stock_qty = ?, stock_units = ?, warning_qty = ?, category = ?,
         supplier = ?, indications = ?, cost_cents = ?, price_cents = ?, is_common = ?,
         updated_at = ? WHERE id = ?`,
      [
        drug.name,
        drug.unit,
        drug.inboundDate,
        productionDate,
        shelfLife.years,
        shelfLife.months,
        shelfLife.days,
        expiryDate,
        expiryAckDate,
        drug.stockQty,
        stockUnits,
        drug.warningQty,
        drug.category,
        drug.supplier,
        drug.indications,
        drug.costCents,
        drug.priceCents,
        drug.isCommon === undefined ? Number(existing.is_common) : drug.isCommon ? 1 : 0,
        nowIso(),
        safeId
      ]
    )
    if (drug.units) this.saveDrugUnits(safeId, drug.units)
    this.syncDrugNotification(safeId)
    this.syncExpiryNotification(safeId)
    this.onDataChanged?.()
    return { id: safeId }
  }

  private getDrugUnits(drugId: number): DrugUnitRow[] {
    return this.store.queryAll<DrugUnitRow>(
      'SELECT * FROM drug_units WHERE drug_id = ? ORDER BY sort_order, id',
      [drugId]
    )
  }

  private saveDrugUnits(drugId: number, units: DrugUnitInput[]): void {
    this.store.run('DELETE FROM drug_units WHERE drug_id = ?', [drugId])
    units.forEach((unit, index) => {
      this.store.insert(
        `INSERT INTO drug_units (drug_id, unit, factor, price_cents, cost_cents, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [drugId, unit.unit, unit.factor, unit.priceCents, unit.costCents, index]
      )
    })
  }

  private resolveDrugUnit(
    drug: DrugRow,
    units: DrugUnitRow[],
    requested?: string
  ): { unit: string; priceCents: number; costCents: number; baseFactor: number } {
    if (!requested || requested === drug.unit) {
      return {
        unit: drug.unit,
        priceCents: Number(drug.price_cents),
        costCents: Number(drug.cost_cents),
        baseFactor: 1
      }
    }
    let unitsPerBase = 1
    for (const unit of units) {
      unitsPerBase *= Number(unit.factor)
      if (unit.unit === requested) {
        return {
          unit: unit.unit,
          priceCents: Number(unit.price_cents),
          costCents: Number(unit.cost_cents),
          baseFactor: 1 / unitsPerBase
        }
      }
    }
    throw new AppError('VALIDATION_ERROR', `药品没有该细分单位：${requested}`)
  }

  setDrugStatus(id: number, status: 'active' | 'stopped'): { id: number } {
    const safeId = idSchema.parse(id)
    if (status !== 'active' && status !== 'stopped') {
      throw new AppError('VALIDATION_ERROR', '状态不正确')
    }
    const result = this.store.run('UPDATE drugs SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      nowIso(),
      safeId
    ])
    if (result === 0) throw new AppError('NOT_FOUND', '药品不存在')
    this.onDataChanged?.()
    return { id: safeId }
  }

  deleteDrug(id: number): { id: number } {
    const safeId = idSchema.parse(id)
    const usage = this.store.queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM prescription_items WHERE drug_id = ?',
      [safeId]
    )
    if (Number(usage?.count ?? 0) > 0) {
      throw new AppError('DRUG_IN_USE', '该药品已被处方使用，只能停用')
    }
    const purchases = this.store.queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM purchases WHERE drug_id = ?',
      [safeId]
    )
    if (Number(purchases?.count ?? 0) > 0) {
      throw new AppError('DRUG_IN_USE', '该药品有进货记录，不能删除，只能停用')
    }
    this.store.run('DELETE FROM drugs WHERE id = ?', [safeId])
    this.onDataChanged?.()
    return { id: safeId }
  }

  purchaseDrug(input: PurchaseInput): { purchaseId: number; stockQty: number; costCents: number } {
    const parsed = purchaseInputSchema.parse(input)
    const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [parsed.drugId])
    if (!drug) throw new AppError('NOT_FOUND', '药品不存在')
    if (drug.status === 'stopped') throw new AppError('VALIDATION_ERROR', '停用药品不能进货')
    const now = nowIso()
    const result = this.store.transaction(() => {
      const purchaseId = this.store.insert(
        `INSERT INTO purchases (drug_id, purchase_date, qty, unit_cost_cents, total_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          parsed.drugId,
          parsed.purchaseDate,
          parsed.qty,
          parsed.unitCostCents,
          multiplyCents(parsed.qty, parsed.unitCostCents),
          now
        ]
      )
      const factor = totalUnitFactor(this.getDrugUnits(parsed.drugId))
      const newStockUnits = Number(drug.stock_units ?? 0) + parsed.qty * factor
      this.store.run(
        `UPDATE drugs SET stock_qty = ?, stock_units = ?, cost_cents = ?, updated_at = ? WHERE id = ?`,
        [newStockUnits / factor, newStockUnits, parsed.unitCostCents, now, parsed.drugId]
      )
      this.syncDrugNotification(parsed.drugId)
      const updated = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [
        parsed.drugId
      ])
      return {
        purchaseId,
        stockQty: Number(updated?.stock_qty ?? 0),
        costCents: Number(updated?.cost_cents ?? 0)
      }
    })
    this.onDataChanged?.()
    return result
  }

  getDrugSuggestions(): { categories: string[]; suppliers: string[] } {
    const categories = this.store
      .queryAll<{ value: string }>(
        "SELECT DISTINCT category AS value FROM drugs WHERE category <> '' ORDER BY category"
      )
      .map((row) => row.value)
    const suppliers = this.store
      .queryAll<{ value: string }>(
        "SELECT DISTINCT supplier AS value FROM drugs WHERE supplier <> '' ORDER BY supplier"
      )
      .map((row) => row.value)
    return { categories, suppliers }
  }

  setDrugCommon(id: number, isCommon: boolean): { id: number } {
    const safeId = idSchema.parse(id)
    const result = this.store.run('UPDATE drugs SET is_common = ?, updated_at = ? WHERE id = ?', [
      isCommon ? 1 : 0,
      nowIso(),
      safeId
    ])
    if (result === 0) throw new AppError('NOT_FOUND', '药品不存在')
    this.onDataChanged?.()
    return { id: safeId }
  }

  lowStockCount(): { count: number } {
    const row = this.store.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM drugs WHERE status = 'active' AND stock_qty <= warning_qty"
    )
    return { count: Number(row?.count ?? 0) }
  }

  // ---------- 用药组合 ----------

  listCombos(): MedicationCombo[] {
    const rows = this.store.queryAll<ComboRow>(
      'SELECT * FROM medication_combos ORDER BY updated_at DESC, id DESC'
    )
    return rows.map((row) => this.mapCombo(row))
  }

  getCombo(id: number): MedicationCombo {
    const safeId = idSchema.parse(id)
    const row = this.store.queryOne<ComboRow>('SELECT * FROM medication_combos WHERE id = ?', [
      safeId
    ])
    if (!row) throw new AppError('NOT_FOUND', '用药组合不存在')
    return this.mapCombo(row)
  }

  createCombo(input: MedicationComboInput): { id: number } {
    const parsed = medicationComboInputSchema.parse(input)
    const now = nowIso()
    const id = this.store.transaction(() => {
      const comboId = this.store.insert(
        'INSERT INTO medication_combos (name, created_at, updated_at) VALUES (?, ?, ?)',
        [parsed.name, now, now]
      )
      parsed.items.forEach((item, index) => {
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [item.drugId])
        if (!drug) throw new AppError('NOT_FOUND', `药品不存在：${item.drugId}`)
        this.store.insert(
          `INSERT INTO medication_combo_items (combo_id, drug_id, qty, unit, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [comboId, item.drugId, item.qty, item.unit ?? drug.unit, index]
        )
      })
      return comboId
    })
    this.onDataChanged?.()
    return { id }
  }

  updateCombo(id: number, input: MedicationComboInput): { id: number } {
    const safeId = idSchema.parse(id)
    const parsed = medicationComboInputSchema.parse(input)
    const existing = this.store.queryOne<ComboRow>('SELECT * FROM medication_combos WHERE id = ?', [
      safeId
    ])
    if (!existing) throw new AppError('NOT_FOUND', '用药组合不存在')
    this.store.transaction(() => {
      this.store.run('UPDATE medication_combos SET name = ?, updated_at = ? WHERE id = ?', [
        parsed.name,
        nowIso(),
        safeId
      ])
      this.store.run('DELETE FROM medication_combo_items WHERE combo_id = ?', [safeId])
      parsed.items.forEach((item, index) => {
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [item.drugId])
        if (!drug) throw new AppError('NOT_FOUND', `药品不存在：${item.drugId}`)
        this.store.insert(
          `INSERT INTO medication_combo_items (combo_id, drug_id, qty, unit, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [safeId, item.drugId, item.qty, item.unit ?? drug.unit, index]
        )
      })
    })
    this.onDataChanged?.()
    return { id: safeId }
  }

  deleteCombo(id: number): { id: number } {
    const safeId = idSchema.parse(id)
    this.store.run('DELETE FROM medication_combos WHERE id = ?', [safeId])
    this.onDataChanged?.()
    return { id: safeId }
  }

  private mapCombo(row: ComboRow): MedicationCombo {
    const items = this.store.queryAll<ComboItemRow>(
      `SELECT i.*, d.name AS drug_name
       FROM medication_combo_items i JOIN drugs d ON d.id = i.drug_id
       WHERE i.combo_id = ? ORDER BY i.sort_order, i.id`,
      [Number(row.id)]
    )
    return {
      id: Number(row.id),
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((item) => ({
        id: Number(item.id),
        comboId: Number(item.combo_id),
        drugId: Number(item.drug_id),
        drugName: item.drug_name,
        unit: item.unit,
        qty: Number(item.qty)
      }))
    }
  }

  // ---------- 处方 ----------

  listPrescriptions(rawQuery: PrescriptionListQuery): ListResult<PrescriptionSummary> {
    const query = prescriptionListQuerySchema.parse(rawQuery ?? {})
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: string[] = []
    const params: (string | number)[] = []

    if (query.query) {
      where.push('(patient_name LIKE ? OR diagnosis LIKE ?)')
      const like = `%${query.query}%`
      params.push(like, like)
    }
    if (query.dateFrom) {
      where.push('issue_date >= ?')
      params.push(query.dateFrom)
    }
    if (query.dateTo) {
      where.push('issue_date <= ?')
      params.push(query.dateTo)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = this.store.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM prescriptions ${whereSql}`,
      params
    )
    const rows = this.store.queryAll<PrescriptionRow>(
      `SELECT p.*,
        (SELECT COALESCE(SUM(i.unit_cost_cents * i.qty), 0)
           FROM prescription_items i WHERE i.prescription_id = p.id) AS cost_cents,
        (SELECT GROUP_CONCAT(i.drug_name, '、')
           FROM prescription_items i WHERE i.prescription_id = p.id) AS medication_text
       FROM prescriptions p ${whereSql}
       ORDER BY p.issue_date DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    )
    return { items: rows.map(mapSummary), total: Number(totalRow?.total ?? 0) }
  }

  getPrescription(id: number): PrescriptionDetail {
    const safeId = idSchema.parse(id)
    const row = this.store.queryOne<PrescriptionRow>(
      `SELECT p.*,
        (SELECT COALESCE(SUM(i.unit_cost_cents * i.qty), 0)
           FROM prescription_items i WHERE i.prescription_id = p.id) AS cost_cents
       FROM prescriptions p WHERE p.id = ?`,
      [safeId]
    )
    if (!row) throw new AppError('NOT_FOUND', '处方不存在')
    const itemRows = this.store.queryAll<PrescriptionItemRow>(
      'SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY sort_order, id',
      [safeId]
    )
    return { ...mapSummary(row), items: itemRows.map(mapItem) }
  }

  createPrescription(
    input: PrescriptionInput,
    allowNegativeStock = false
  ): PrescriptionSaveResult {
    const parsed = prescriptionInputSchema.parse(input)
    const now = nowIso()
    const result = this.store.transaction(() => {
      const prepared = parsed.items.map((item, index) => {
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [item.drugId])
        if (!drug) throw new AppError('NOT_FOUND', `药品不存在：${item.drugId}`)
        if (drug.status !== 'active') {
          throw new AppError('VALIDATION_ERROR', `药品已停用：${drug.name}`)
        }
        const resolved = this.resolveDrugUnit(drug, this.getDrugUnits(Number(drug.id)), item.unit)
        const amountCents = multiplyCents(item.qty, resolved.priceCents)
        return {
          item,
          index,
          drug,
          ...resolved,
          amountCents,
          costCents: multiplyCents(item.qty, resolved.costCents),
          unitPriceCents: resolved.priceCents,
          unitCostCents: resolved.costCents
        }
      })

      const feeCents = parsed.feeCents ?? 0
      const drugAmountCents = feeCents
      const totalCents = feeCents

      const warnings = prepared
        .filter((row) => {
          const factor = totalUnitFactor(this.getDrugUnits(Number(row.drug.id)))
          return Number(row.drug.stock_units ?? 0) < row.item.qty * row.baseFactor * factor
        })
        .map(
          (row) =>
            `${row.drug.name}：需要 ${row.item.qty}${row.unit}，当前 ${formatDrugStock({
              unit: row.drug.unit,
              stockQty: Number(row.drug.stock_qty),
              stockUnits: Number(row.drug.stock_units ?? 0),
              units: this.getDrugUnits(Number(row.drug.id)).map(mapDrugUnit)
            })}`
        )
      if (warnings.length > 0 && !allowNegativeStock) {
        throw new AppError('STOCK_INSUFFICIENT', '库存不足', warnings)
      }

      const prescriptionId = this.store.insert(
        `INSERT INTO prescriptions
          (patient_name, gender, age, diagnosis, issue_date, rp, doctor,
           drug_amount_cents, injection_fee_cents, fee_cents, total_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.patientName,
          parsed.gender,
          parsed.age,
          parsed.diagnosis,
          parsed.issueDate,
          parsed.rp,
          parsed.doctor,
          drugAmountCents,
          0,
          feeCents,
          totalCents,
          now,
          now
        ]
      )

      for (const row of prepared) {
        this.store.insert(
          `INSERT INTO prescription_items
            (prescription_id, drug_id, drug_name, unit, unit_factor, qty, usage, frequency,
             group_key, group_name, group_usage,
             unit_price_cents, unit_cost_cents, amount_cents, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prescriptionId,
            row.item.drugId,
            row.drug.name,
            row.unit,
            row.baseFactor,
            row.item.qty,
            row.item.usage,
            row.item.frequency,
            row.item.groupKey ?? '',
            row.item.groupName ?? '',
            row.item.groupUsage ?? '',
            row.unitPriceCents,
            row.unitCostCents,
            row.amountCents,
            row.index
          ]
        )
        const factor = totalUnitFactor(this.getDrugUnits(row.item.drugId))
        const deducted = row.item.qty * row.baseFactor * factor
        const newUnits = Math.round(Number(row.drug.stock_units ?? 0) - deducted)
        this.store.run(
          'UPDATE drugs SET stock_qty = ?, stock_units = ?, updated_at = ? WHERE id = ?',
          [newUnits / factor, newUnits, now, row.item.drugId]
        )
        this.syncDrugNotification(row.item.drugId)
      }

      return { id: prescriptionId, warnings }
    })
    this.onDataChanged?.()
    return result
  }

  updatePrescription(
    id: number,
    input: PrescriptionInput,
    allowNegativeStock = false
  ): PrescriptionSaveResult {
    const safeId = idSchema.parse(id)
    const parsed = prescriptionInputSchema.parse(input)
    const now = nowIso()
    const result = this.store.transaction(() => {
      const existing = this.store.queryOne<PrescriptionRow>('SELECT * FROM prescriptions WHERE id = ?', [
        safeId
      ])
      if (!existing) throw new AppError('NOT_FOUND', '处方不存在')
      const oldItems = this.store.queryAll<PrescriptionItemRow>(
        'SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY sort_order, id',
        [safeId]
      )
      const oldById = new Map(oldItems.map((item) => [Number(item.id), item]))

      const prepared = parsed.items.map((item, index) => {
        const old = item.id ? oldById.get(item.id) : undefined
        if (item.id && !old) throw new AppError('VALIDATION_ERROR', '处方明细不存在')
        if (old) {
          return {
            item,
            index,
            old,
            drugName: old.drug_name,
            unit: old.unit,
            baseFactor: Number(old.unit_factor ?? 1),
            unitPriceCents: Number(old.unit_price_cents),
            unitCostCents: Number(old.unit_cost_cents),
            amountCents: multiplyCents(item.qty, Number(old.unit_price_cents))
          }
        }
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [item.drugId])
        if (!drug) throw new AppError('NOT_FOUND', `药品不存在：${item.drugId}`)
        if (drug.status !== 'active') {
          throw new AppError('VALIDATION_ERROR', `药品已停用：${drug.name}`)
        }
        const resolved = this.resolveDrugUnit(drug, this.getDrugUnits(Number(drug.id)), item.unit)
        return {
          item,
          index,
          old: null,
          drugName: drug.name,
          ...resolved,
          unitPriceCents: resolved.priceCents,
          unitCostCents: resolved.costCents,
          amountCents: multiplyCents(item.qty, resolved.priceCents)
        }
      })

      const feeCents = parsed.feeCents ?? 0
      const drugAmountCents = feeCents
      const totalCents = feeCents

      const medicationsUnchanged =
        oldItems.length === parsed.items.length &&
        parsed.items.every((item) => {
          const old = item.id ? oldById.get(item.id) : undefined
          return (
            old != null &&
            Number(old.drug_id) === item.drugId &&
            Number(old.qty) === item.qty &&
            old.unit === (item.unit ?? old.unit)
          )
        })

      const stockDelta = new Map<number, number>()
      if (!medicationsUnchanged) {
        for (const old of oldItems) {
          const factor = totalUnitFactor(this.getDrugUnits(Number(old.drug_id)))
          stockDelta.set(
            Number(old.drug_id),
            (stockDelta.get(Number(old.drug_id)) ?? 0) +
              Number(old.qty) * Number(old.unit_factor ?? 1) * factor
          )
        }
        for (const row of prepared) {
          const drugId = row.old ? Number(row.old.drug_id) : row.item.drugId
          const factor = totalUnitFactor(this.getDrugUnits(drugId))
          stockDelta.set(drugId, (stockDelta.get(drugId) ?? 0) - row.item.qty * row.baseFactor * factor)
        }
      }

      const warnings: string[] = []
      for (const [drugId, delta] of stockDelta.entries()) {
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [drugId])
        if (!drug) continue
        const finalStock = Number(drug.stock_units ?? 0) + delta
        if (finalStock < 0) {
          warnings.push(
            `${drug.name}：库存不足，当前 ${formatDrugStock({
              unit: drug.unit,
              stockQty: Number(drug.stock_qty),
              stockUnits: Number(drug.stock_units ?? 0),
              units: this.getDrugUnits(drugId).map(mapDrugUnit)
            })}`
          )
        }
      }
      if (warnings.length > 0 && !allowNegativeStock) {
        throw new AppError('STOCK_INSUFFICIENT', '库存不足', warnings)
      }

      this.store.run(
        `UPDATE prescriptions SET patient_name = ?, gender = ?, age = ?, diagnosis = ?,
           issue_date = ?, rp = ?, doctor = ?, drug_amount_cents = ?, injection_fee_cents = ?,
           fee_cents = ?, total_cents = ?, updated_at = ?
         WHERE id = ?`,
        [
          parsed.patientName,
          parsed.gender,
          parsed.age,
          parsed.diagnosis,
          parsed.issueDate,
          parsed.rp,
          parsed.doctor,
          drugAmountCents,
          0,
          feeCents,
          totalCents,
          now,
          safeId
        ]
      )

      const keepIds = new Set(prepared.filter((row) => row.old).map((row) => Number(row.old!.id)))
      for (const old of oldItems) {
        if (!keepIds.has(Number(old.id))) {
          this.store.run('DELETE FROM prescription_items WHERE id = ?', [Number(old.id)])
        }
      }

      for (const row of prepared) {
        if (row.old) {
          this.store.run(
            `UPDATE prescription_items
             SET qty = ?, usage = ?, frequency = ?, group_key = ?, group_name = ?,
                 group_usage = ?, amount_cents = ?, sort_order = ?
             WHERE id = ?`,
            [
              row.item.qty,
              row.item.usage,
              row.item.frequency,
              row.item.groupKey ?? row.old.group_key ?? '',
              row.item.groupName ?? row.old.group_name ?? '',
              row.item.groupUsage ?? row.old.group_usage ?? '',
              row.amountCents,
              row.index,
              Number(row.old.id)
            ]
          )
        } else {
          this.store.insert(
            `INSERT INTO prescription_items
              (prescription_id, drug_id, drug_name, unit, unit_factor, qty, usage, frequency,
               group_key, group_name, group_usage,
               unit_price_cents, unit_cost_cents, amount_cents, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              safeId,
              row.item.drugId,
              row.drugName,
              row.unit,
              row.baseFactor,
              row.item.qty,
              row.item.usage,
              row.item.frequency,
              row.item.groupKey ?? '',
              row.item.groupName ?? '',
              row.item.groupUsage ?? '',
              row.unitPriceCents,
              row.unitCostCents,
              row.amountCents,
              row.index
            ]
          )
        }
      }

      for (const [drugId, delta] of stockDelta.entries()) {
        if (delta === 0) continue
        const factor = totalUnitFactor(this.getDrugUnits(drugId))
        const current = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [drugId])
        const nextUnits = Math.round(Number(current?.stock_units ?? 0) + delta)
        this.store.run(
          'UPDATE drugs SET stock_qty = ?, stock_units = ?, updated_at = ? WHERE id = ?',
          [nextUnits / factor, nextUnits, now, drugId]
        )
        this.syncDrugNotification(drugId)
      }

      return { id: safeId, warnings }
    })
    this.onDataChanged?.()
    return result
  }

  deletePrescription(id: number): { id: number } {
    const safeId = idSchema.parse(id)
    this.store.transaction(() => {
      const existing = this.store.queryOne<PrescriptionRow>('SELECT * FROM prescriptions WHERE id = ?', [
        safeId
      ])
      if (!existing) throw new AppError('NOT_FOUND', '处方不存在')
      const items = this.store.queryAll<PrescriptionItemRow>(
        'SELECT * FROM prescription_items WHERE prescription_id = ?',
        [safeId]
      )
      const now = nowIso()
      for (const item of items) {
        const drugId = Number(item.drug_id)
        const factor = totalUnitFactor(this.getDrugUnits(drugId))
        const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [drugId])
        const nextUnits = Math.round(
          Number(drug?.stock_units ?? 0) +
            Number(item.qty) * Number(item.unit_factor ?? 1) * factor
        )
        this.store.run(
          'UPDATE drugs SET stock_qty = ?, stock_units = ?, updated_at = ? WHERE id = ?',
          [nextUnits / factor, nextUnits, now, drugId]
        )
      }
      this.store.run('DELETE FROM prescriptions WHERE id = ?', [safeId])
      for (const item of items) {
        this.syncDrugNotification(Number(item.drug_id))
      }
    })
    this.onDataChanged?.()
    return { id: safeId }
  }

  // ---------- 财务 ----------

  financeSummary(rawQuery: FinanceQuery): FinanceResult {
    const query = financeQuerySchema.parse(rawQuery)
    const range = getPeriodRange(query.period, query.anchorDate)
    const summary = this.financeTotals(range.from, range.to)
    const rows =
      query.period === 'day'
        ? this.financeDayRows(range.from)
        : this.financeGroupRows(query.period, range.from, range.to)
    return {
      period: query.period,
      anchorDate: query.anchorDate,
      from: range.from,
      to: range.to,
      summary,
      rows
    }
  }

  financeDetails(rawQuery: FinanceDetailsQuery): FinanceDetails {
    const query = financeDetailsQuerySchema.parse(rawQuery)
    if (query.key.startsWith('p-')) {
      const id = Number(query.key.slice(2))
      const prescription = this.getPrescription(id)
      const { items, ...base } = prescription
      return {
        key: query.key,
        label: `${prescription.patientName} · ${prescription.issueDate}`,
        items: [
          {
            ...base,
            medicationText: items.map((item) => item.drugName).join('、')
          }
        ]
      }
    }
    let from = query.key
    let to = query.key
    if (query.period === 'week' || query.period === 'month') {
      from = query.key
      to = query.key
    } else if (query.period === 'year') {
      from = `${query.key}-01`
      to = `${query.key}-31`
    }
    const rows = this.store.queryAll<PrescriptionRow>(
      `SELECT p.*,
        (SELECT COALESCE(SUM(i.unit_cost_cents * i.qty), 0)
           FROM prescription_items i WHERE i.prescription_id = p.id) AS cost_cents,
        (SELECT GROUP_CONCAT(i.drug_name, '、')
           FROM prescription_items i WHERE i.prescription_id = p.id) AS medication_text
       FROM prescriptions p
       WHERE p.issue_date >= ? AND p.issue_date <= ?
       ORDER BY p.issue_date DESC, p.id DESC`,
      [from, to]
    )
    return {
      key: query.key,
      label: query.label ?? query.key,
      items: rows.map(mapSummary)
    }
  }

  private financeTotals(from: string, to: string): FinanceSummary {
    const row = this.store.queryOne<{ count: number; revenue_cents: number }>(
      `SELECT COUNT(*) AS count,
        COALESCE(SUM(p.fee_cents), 0) AS revenue_cents
       FROM prescriptions p WHERE p.issue_date >= ? AND p.issue_date <= ?`,
      [from, to]
    )
    return {
      revenueCents: Number(row?.revenue_cents ?? 0),
      count: Number(row?.count ?? 0)
    }
  }

  private financeDayRows(date: string): FinanceRow[] {
    const rows = this.store.queryAll<PrescriptionRow>(
      `SELECT p.*,
        (SELECT COALESCE(SUM(i.unit_cost_cents * i.qty), 0)
           FROM prescription_items i WHERE i.prescription_id = p.id) AS cost_cents,
        (SELECT GROUP_CONCAT(i.drug_name, '、')
           FROM prescription_items i WHERE i.prescription_id = p.id) AS medication_text
       FROM prescriptions p WHERE p.issue_date = ? ORDER BY p.id DESC`,
      [date]
    )
    return rows.map((row) => {
      return {
        key: `p-${row.id}`,
        label: `${row.patient_name} · ${row.issue_date}`,
        revenueCents: Number(row.fee_cents ?? row.total_cents),
        count: 1
      }
    })
  }

  private financeGroupRows(period: 'week' | 'month' | 'year', from: string, to: string): FinanceRow[] {
    const groupExpr = period === 'year' ? "substr(p.issue_date, 1, 7)" : 'p.issue_date'
    const rows = this.store.queryAll<{
      group_key: string
      count: number
      revenue_cents: number
    }>(
      `SELECT ${groupExpr} AS group_key,
        COUNT(*) AS count,
        COALESCE(SUM(p.fee_cents), 0) AS revenue_cents
       FROM prescriptions p
       WHERE p.issue_date >= ? AND p.issue_date <= ?
       GROUP BY ${groupExpr}
       ORDER BY group_key ASC`,
      [from, to]
    )
    return rows.map((row) => {
      return {
        key: row.group_key,
        label: getGroupLabel(period, row.group_key),
        revenueCents: Number(row.revenue_cents),
        count: Number(row.count)
      }
    })
  }

  // ---------- 通知 ----------

  listNotifications(): { items: Notification[]; unreadCount: number } {
    this.syncAllNotifications()
    const rows = this.store.queryAll<NotificationRow>(
      'SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 100'
    )
    return {
      items: rows.map(mapNotification),
      unreadCount: rows.filter((row) => !row.read_at).length
    }
  }

  unreadNotificationCount(): { count: number } {
    this.syncAllNotifications()
    const row = this.store.queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE read_at IS NULL'
    )
    return { count: Number(row?.count ?? 0) }
  }

  markNotificationRead(id: number): { unreadCount: number } {
    const safeId = idSchema.parse(id)
    this.store.run('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [
      nowIso(),
      safeId
    ])
    this.onDataChanged?.()
    return { unreadCount: this.unreadNotificationCount().count }
  }

  markAllNotificationsRead(): { unreadCount: number } {
    this.store.run('UPDATE notifications SET read_at = ? WHERE read_at IS NULL', [nowIso()])
    this.onDataChanged?.()
    return { unreadCount: 0 }
  }

  syncAllNotifications(): void {
    const drugs = this.store.queryAll<DrugRow>("SELECT * FROM drugs WHERE status = 'active'")
    for (const drug of drugs) {
      this.syncDrugNotification(Number(drug.id))
      this.syncExpiryNotification(Number(drug.id))
    }
  }

  confirmDrugExpiry(id: number): { id: number } {
    const safeId = idSchema.parse(id)
    const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [safeId])
    if (!drug) throw new AppError('NOT_FOUND', '药品不存在')
    if (drug.expiry_date) {
      this.store.run('UPDATE drugs SET expiry_ack_date = ?, updated_at = ? WHERE id = ?', [
        drug.expiry_date,
        nowIso(),
        safeId
      ])
      this.store.run(
        "UPDATE notifications SET read_at = ? WHERE drug_id = ? AND reason = 'expiry' AND read_at IS NULL",
        [nowIso(), safeId]
      )
    }
    this.onDataChanged?.()
    return { id: safeId }
  }

  private syncExpiryNotification(drugId: number): void {
    const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [drugId])
    const now = nowIso()
    if (!drug || drug.status !== 'active' || !drug.expiry_date) return
    const shouldAlert = isExpiryWarning(drug.expiry_date, drug.expiry_ack_date)
    if (!shouldAlert) {
      this.store.run(
        "UPDATE notifications SET read_at = ? WHERE drug_id = ? AND reason = 'expiry' AND read_at IS NULL",
        [now, drugId]
      )
      return
    }
    const same = this.store.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM notifications WHERE drug_id = ? AND reason = 'expiry' AND expiry_date = ? AND read_at IS NULL",
      [drugId, drug.expiry_date]
    )
    if (Number(same?.count ?? 0) > 0) return
    this.store.run(
      "UPDATE notifications SET read_at = ? WHERE drug_id = ? AND reason = 'expiry' AND read_at IS NULL",
      [now, drugId]
    )
    this.store.insert(
      `INSERT INTO notifications (drug_id, drug_name, stock_qty, warning_qty, expiry_date, reason, created_at)
       VALUES (?, ?, ?, ?, ?, 'expiry', ?)`,
      [
        drugId,
        drug.name,
        Number(drug.stock_qty),
        Number(drug.warning_qty),
        drug.expiry_date,
        now
      ]
    )
  }

  private syncDrugNotification(drugId: number): void {
    const drug = this.store.queryOne<DrugRow>('SELECT * FROM drugs WHERE id = ?', [drugId])
    if (!drug || drug.status !== 'active') return
    const now = nowIso()
    if (Number(drug.stock_qty) > Number(drug.warning_qty)) {
      this.store.run(
        "UPDATE notifications SET read_at = ? WHERE drug_id = ? AND reason = 'stock_low' AND read_at IS NULL",
        [now, drugId]
      )
      return
    }
    const unread = this.store.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM notifications WHERE drug_id = ? AND reason = 'stock_low' AND read_at IS NULL",
      [drugId]
    )
    if (Number(unread?.count ?? 0) > 0) return
    const latest = this.store.queryOne<{ created_at: string }>(
      "SELECT created_at FROM notifications WHERE drug_id = ? AND reason = 'stock_low' ORDER BY created_at DESC, id DESC LIMIT 1",
      [drugId]
    )
    const today = localDateOf(now)
    if (latest && localDateOf(latest.created_at) === today) return
    this.store.insert(
      `INSERT INTO notifications (drug_id, drug_name, stock_qty, warning_qty, reason, created_at)
       VALUES (?, ?, ?, ?, 'stock_low', ?)`,
      [drugId, drug.name, Number(drug.stock_qty), Number(drug.warning_qty), now]
    )
  }

  // ---------- 设置 ----------

  getSettings(): Settings {
    const rows = this.store.queryAll<SettingsRow>('SELECT key, value FROM settings')
    const result: Settings = {
      ...DEFAULT_SETTINGS,
      viewModes: { ...DEFAULT_SETTINGS.viewModes }
    }
    for (const row of rows) {
      try {
        const value = JSON.parse(row.value)
        if (row.key === 'theme') result.theme = value
        if (row.key === 'lastDoctor') result.lastDoctor = value
        if (row.key === 'viewModes') result.viewModes = { ...result.viewModes, ...value }
        if (row.key === 'lastExportDir') result.lastExportDir = value
        if (row.key === 'signatureImage') result.signatureImage = value
        if (row.key === 'signatureX') result.signatureX = value
        if (row.key === 'signatureY') result.signatureY = value
        if (row.key === 'signatureWidth') result.signatureWidth = value
      } catch {
        // ignore malformed setting
      }
    }
    return result
  }

  setSettings(patch: Partial<Settings>): Settings {
    const parsed = settingsPatchSchema.parse(patch)
    const now = nowIso()
    const entries: [string, unknown][] = []
    if (parsed.theme !== undefined) entries.push(['theme', parsed.theme])
    if (parsed.lastDoctor !== undefined) entries.push(['lastDoctor', parsed.lastDoctor])
    if (parsed.viewModes !== undefined) entries.push(['viewModes', parsed.viewModes])
    if (parsed.lastExportDir !== undefined) entries.push(['lastExportDir', parsed.lastExportDir])
    if (parsed.signatureImage !== undefined) entries.push(['signatureImage', parsed.signatureImage])
    if (parsed.signatureX !== undefined) entries.push(['signatureX', parsed.signatureX])
    if (parsed.signatureY !== undefined) entries.push(['signatureY', parsed.signatureY])
    if (parsed.signatureWidth !== undefined) entries.push(['signatureWidth', parsed.signatureWidth])
    for (const [key, value] of entries) {
      this.store.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), now]
      )
    }
    this.onDataChanged?.()
    return this.getSettings()
  }

  // ---------- 打印/导出辅助 ----------

  getPrescriptionsForPrint(ids: number[]): PrescriptionDetail[] {
    return ids.map((id) => this.getPrescription(id))
  }

  formatMoney(cents: number): string {
    return formatCents(cents)
  }

  formatDateTime(iso: string): string {
    return formatDateTime(iso)
  }
}
