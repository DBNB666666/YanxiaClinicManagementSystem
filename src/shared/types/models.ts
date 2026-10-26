export type Theme = 'light' | 'dark' | 'reading'
export type Gender = '男' | '女'
export type DrugStatus = 'active' | 'stopped'
export type FinancePeriod = 'day' | 'week' | 'month' | 'year'
export type ViewMode = 'card' | 'list'
export type DrugListFilter = 'all' | 'low' | 'stopped' | 'common'

export interface DrugUnit {
  id: number
  unit: string
  factor: number
  priceCents: number
  costCents: number
}

export interface DrugUnitInput {
  unit: string
  factor: number
  priceCents: number
  costCents: number
}

export interface Drug {
  id: number
  name: string
  unit: string
  units: DrugUnit[]
  inboundDate: string
  stockQty: number
  stockUnits: number
  warningQty: number
  productionDate: string
  shelfLifeYears: number
  shelfLifeMonths: number
  shelfLifeDays: number
  expiryDate: string
  expiryAckDate: string
  expiring: boolean
  isCommon: boolean
  category: string
  supplier: string
  indications: string
  costCents: number
  priceCents: number
  status: DrugStatus
  createdAt: string
  updatedAt: string
  usageCount: number
}

export interface DrugInput {
  name: string
  unit: string
  inboundDate: string
  stockQty: number
  warningQty: number
  category: string
  supplier: string
  indications: string
  costCents: number
  priceCents: number
  productionDate?: string
  shelfLifeYears?: number
  shelfLifeMonths?: number
  shelfLifeDays?: number
  expiryAckDate?: string
  isCommon?: boolean
  units?: DrugUnitInput[]
}

export interface Purchase {
  id: number
  drugId: number
  purchaseDate: string
  qty: number
  unitCostCents: number
  totalCents: number
  createdAt: string
}

export interface DrugDetail extends Drug {
  purchases: Purchase[]
}

export interface PurchaseInput {
  drugId: number
  purchaseDate: string
  qty: number
  unitCostCents: number
}

export interface PrescriptionItem {
  id: number
  prescriptionId: number
  drugId: number
  drugName: string
  unit: string
  unitFactor: number
  qty: number
  usage: string
  frequency: string
  groupKey: string
  groupName: string
  groupUsage: string
  unitPriceCents: number
  unitCostCents: number
  amountCents: number
}

export interface Prescription {
  id: number
  patientName: string
  gender: Gender
  age: string
  diagnosis: string
  issueDate: string
  rp: string
  doctor: string
  drugAmountCents: number
  injectionFeeCents: number
  feeCents: number
  totalCents: number
  costCents: number
  createdAt: string
  updatedAt: string
}

export interface PrescriptionSummary extends Prescription {
  medicationText: string
}

export interface PrescriptionDetail extends Prescription {
  items: PrescriptionItem[]
}

export interface PrescriptionItemInput {
  id?: number
  drugId: number
  unit?: string
  qty: number
  usage: string
  frequency: string
  groupKey?: string
  groupName?: string
  groupUsage?: string
}

export interface MedicationComboItem {
  id: number
  comboId: number
  drugId: number
  drugName: string
  unit: string
  qty: number
}

export interface MedicationCombo {
  id: number
  name: string
  items: MedicationComboItem[]
  createdAt: string
  updatedAt: string
}

export interface MedicationComboItemInput {
  drugId: number
  unit?: string
  qty: number
}

export interface MedicationComboInput {
  name: string
  items: MedicationComboItemInput[]
}

export interface PrescriptionInput {
  patientName: string
  gender: Gender
  age: string
  diagnosis: string
  issueDate: string
  rp?: string
  doctor: string
  items: PrescriptionItemInput[]
  injectionFeeCents?: number
  manualDrugAmountCents?: number | null
  feeCents?: number
}

export interface PrescriptionSaveResult {
  id: number
  warnings: string[]
}

export interface Notification {
  id: number
  drugId: number
  drugName: string
  stockQty: number
  warningQty: number
  expiryDate: string
  reason: string
  createdAt: string
  readAt: string | null
}

export interface Settings {
  theme: Theme
  lastDoctor: string
  viewModes: Record<'prescriptions' | 'pharmacy', ViewMode>
  lastExportDir: string
  signatureImage: string
  signatureX: number
  signatureY: number
  signatureWidth: number
}

export interface FinanceSummary {
  revenueCents: number
  count: number
}

export interface FinanceRow {
  key: string
  label: string
  revenueCents: number
  count: number
}

export interface FinanceResult {
  period: FinancePeriod
  anchorDate: string
  from: string
  to: string
  summary: FinanceSummary
  rows: FinanceRow[]
}

export interface FinanceDetails {
  key: string
  label: string
  items: PrescriptionSummary[]
}

export interface ListResult<T> {
  items: T[]
  total: number
}

export interface AppInfo {
  version: string
  dataDir: string
  lastBackupAt: string | null
}

export interface DrugListQuery {
  query?: string
  filter?: DrugListFilter
  page?: number
  pageSize?: number
}

export interface PrescriptionListQuery {
  query?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface FinanceQuery {
  period: FinancePeriod
  anchorDate: string
}

export interface FinanceDetailsQuery extends FinanceQuery {
  key: string
  label?: string
}
