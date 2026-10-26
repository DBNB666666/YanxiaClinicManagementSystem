import type {
  MedicationCombo,
  MedicationComboInput,
  AppInfo,
  Drug,
  DrugDetail,
  DrugInput,
  DrugListQuery,
  FinanceDetails,
  FinanceDetailsQuery,
  FinanceQuery,
  FinanceResult,
  ListResult,
  Notification,
  PrescriptionDetail,
  PrescriptionInput,
  PrescriptionListQuery,
  PrescriptionSaveResult,
  PrescriptionSummary,
  PurchaseInput,
  Settings
} from './models'

export interface ClinicApi {
  app: {
    getInfo(): Promise<AppInfo>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  drugs: {
    list(query: DrugListQuery): Promise<ListResult<Drug>>
    get(id: number): Promise<DrugDetail>
    create(input: DrugInput): Promise<{ id: number }>
    update(id: number, input: DrugInput): Promise<{ id: number }>
    setStatus(id: number, status: 'active' | 'stopped'): Promise<{ id: number }>
    remove(id: number): Promise<{ id: number }>
    purchase(input: PurchaseInput): Promise<{
      purchaseId: number
      stockQty: number
      costCents: number
    }>
    lowStockCount(): Promise<{ count: number }>
    suggestions(): Promise<{ categories: string[]; suppliers: string[] }>
    confirmExpiry(id: number): Promise<{ id: number }>
    confirmBatchExpiry(batchId: number): Promise<{ id: number }>
    setCommon(id: number, isCommon: boolean): Promise<{ id: number }>
  }
  combos: {
    list(): Promise<MedicationCombo[]>
    get(id: number): Promise<MedicationCombo>
    create(input: MedicationComboInput): Promise<{ id: number }>
    update(id: number, input: MedicationComboInput): Promise<{ id: number }>
    remove(id: number): Promise<{ id: number }>
  }
  prescriptions: {
    list(query: PrescriptionListQuery): Promise<ListResult<PrescriptionSummary>>
    get(id: number): Promise<PrescriptionDetail>
    create(input: PrescriptionInput, allowNegativeStock?: boolean): Promise<PrescriptionSaveResult>
    update(
      id: number,
      input: PrescriptionInput,
      allowNegativeStock?: boolean
    ): Promise<PrescriptionSaveResult>
    remove(id: number): Promise<{ id: number }>
  }
  finance: {
    summary(query: FinanceQuery): Promise<FinanceResult>
    details(query: FinanceDetailsQuery): Promise<FinanceDetails>
  }
  notifications: {
    list(): Promise<{ items: Notification[]; unreadCount: number }>
    unreadCount(): Promise<{ count: number }>
    markRead(id: number): Promise<{ unreadCount: number }>
    markAllRead(): Promise<{ unreadCount: number }>
  }
  print: {
    printPrescription(ids: number[]): Promise<{ path: string }>
    exportPdf(ids: number[]): Promise<{ path: string }>
  }
}

export interface ApiErrorShape {
  code: string
  message: string
  details?: unknown
}
