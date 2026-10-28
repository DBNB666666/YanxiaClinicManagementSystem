import type {
  Drug,
  MedicationCombo,
  PrescriptionDetail,
  PrescriptionItem,
  Purchase
} from './types/models'

export type BackupPrescriptionItem = PrescriptionItem & { batchUid: string }
export type BackupPrescription = Omit<PrescriptionDetail, 'items'> & {
  items: BackupPrescriptionItem[]
}

export interface BackupData {
  drugs: Drug[]
  prescriptions: BackupPrescription[]
  purchases: Purchase[]
  combos: MedicationCombo[]
}

export interface BackupFile {
  format: 'yanxia-clinic-backup'
  appVersion: string
  schemaVersion: number
  createdAt: string
  signatureImage: string
  data: BackupData
}

export interface BackupImportResult {
  drugs: number
  prescriptions: number
  purchases: number
  combos: number
  skipped: number
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<BackupFile>
  return (
    file.format === 'yanxia-clinic-backup' &&
    typeof file.appVersion === 'string' &&
    typeof file.createdAt === 'string' &&
    Boolean(file.data) &&
    Array.isArray(file.data?.drugs) &&
    Array.isArray(file.data?.prescriptions) &&
    Array.isArray(file.data?.purchases) &&
    Array.isArray(file.data?.combos)
  )
}
