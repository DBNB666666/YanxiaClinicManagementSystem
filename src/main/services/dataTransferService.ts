import type { SqliteStore } from '../db/store'
import { SCHEMA_VERSION } from '../db/schema'
import type { BackupFile, BackupImportResult, BackupPrescription } from '../../shared/backup'
import { isBackupFile } from '../../shared/backup'
import type { ClinicService } from './clinicService'
import type { Drug, DrugBatch, DrugUnitInput } from '../../shared/types/models'
import { AppError } from '../../shared/result'

interface UidRow {
  id: number
  uid: string
}

function saveUnits(store: SqliteStore, drugId: number, units: DrugUnitInput[]): void {
  units.forEach((unit, index) => {
    store.insert(
      `INSERT INTO drug_units (drug_id, unit, factor, price_cents, cost_cents, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [drugId, unit.unit, unit.factor, unit.priceCents, unit.costCents, index]
    )
  })
}

function recalcStock(store: SqliteStore, drugId: number): void {
  const batches = store.queryAll<{ qty_units: number }>(
    'SELECT qty_units FROM drug_batches WHERE drug_id = ?',
    [drugId]
  )
  const units = store.queryAll<{ factor: number }>(
    'SELECT factor FROM drug_units WHERE drug_id = ?',
    [drugId]
  )
  const factor = units.reduce((total, unit) => total * Number(unit.factor), 1)
  const totalUnits = batches.reduce((sum, batch) => sum + Number(batch.qty_units), 0)
  store.run(
    'UPDATE drugs SET stock_units = ?, stock_qty = ?, updated_at = ? WHERE id = ?',
    [totalUnits, totalUnits / factor, new Date().toISOString(), drugId]
  )
}

function batchFromDrug(drug: Drug): DrugBatch[] {
  return drug.batches ?? []
}

export function buildBackup(service: ClinicService, appVersion: string): BackupFile {
  const drugIds: number[] = []
  const drugTotal = service.listDrugs({ page: 1, pageSize: 100 }).total
  for (let page = 1; page <= Math.ceil(drugTotal / 100); page += 1) {
    for (const item of service.listDrugs({ page, pageSize: 100 }).items) drugIds.push(item.id)
  }
  const drugs = drugIds.map((id) => {
    const detail = service.getDrug(id)
    const { purchases, ...rest } = detail
    void purchases
    return rest
  })
  const batchUid = new Map<number, string>()
  for (const drug of drugs) {
    for (const batch of batchFromDrug(drug)) batchUid.set(batch.id, batch.uid)
  }
  const prescriptions: BackupPrescription[] = []
  const totalPrescriptions = service.listPrescriptions({ page: 1, pageSize: 100 }).total
  for (let page = 1; page <= Math.ceil(totalPrescriptions / 100); page += 1) {
    const list = service.listPrescriptions({ page, pageSize: 100 })
    for (const summary of list.items) {
      const detail = service.getPrescription(summary.id)
      prescriptions.push({
        ...detail,
        items: detail.items.map((item) => ({
          ...item,
          batchUid: batchUid.get(item.batchId) ?? ''
        }))
      })
    }
  }
  const purchases = drugIds.flatMap((id) => service.getDrug(id).purchases)
  return {
    format: 'yanxia-clinic-backup',
    appVersion,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    signatureImage: service.getSettings().signatureImage,
    data: {
      drugs,
      prescriptions,
      purchases,
      combos: service.listCombos()
    }
  }
}

export function mergeBackup(store: SqliteStore, service: ClinicService, input: unknown): BackupImportResult {
  if (!isBackupFile(input)) {
    throw new AppError('VALIDATION_ERROR', '不是有效的燕霞数据备份文件')
  }
  const file = input
  const major = Number(file.appVersion.split('.')[0])
  if (!Number.isFinite(major) || major < 1) {
    throw new AppError('VALIDATION_ERROR', '备份文件版本过旧，至少需要 1.0.0')
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    throw new AppError('VALIDATION_ERROR', '备份文件来自更高版本，请先更新软件')
  }
  const result: BackupImportResult = {
    drugs: 0,
    prescriptions: 0,
    purchases: 0,
    combos: 0,
    skipped: 0
  }
  const drugIdByUid = new Map<string, number>()
  const batchIdByUid = new Map<string, number>()

  store.transaction(() => {
    for (const drug of file.data.drugs) {
      if (!drug.uid) continue
      const existing = store.queryOne<{ id: number }>('SELECT id FROM drugs WHERE uid = ?', [drug.uid])
      let drugId: number
      if (existing) {
        drugId = Number(existing.id)
        result.skipped += 1
      } else {
        drugId = store.insert(
          `INSERT INTO drugs
            (uid, name, unit, inbound_date, production_date, shelf_life_years, shelf_life_months,
             shelf_life_days, expiry_date, expiry_ack_date, stock_qty, stock_units, warning_qty,
             category, supplier, indications, cost_cents, price_cents, is_common, status,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
          [
            drug.uid,
            drug.name,
            drug.unit,
            drug.inboundDate,
            drug.productionDate,
            drug.shelfLifeYears,
            drug.shelfLifeMonths,
            drug.shelfLifeDays,
            drug.expiryDate,
            drug.expiryAckDate,
            drug.stockQty,
            drug.stockUnits,
            drug.warningQty,
            drug.category,
            drug.supplier,
            drug.indications,
            drug.costCents,
            drug.priceCents,
            drug.isCommon ? 1 : 0,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        )
        saveUnits(
          store,
          drugId,
          drug.units.map((unit) => ({
            unit: unit.unit,
            factor: unit.factor,
            priceCents: unit.priceCents,
            costCents: unit.costCents
          }))
        )
        result.drugs += 1
      }
      drugIdByUid.set(drug.uid, drugId)
      const existingBatches = store.queryAll<UidRow>(
        'SELECT id, uid FROM drug_batches WHERE drug_id = ?',
        [drugId]
      )
      for (const batch of existingBatches) batchIdByUid.set(batch.uid, Number(batch.id))
      for (const batch of drug.batches) {
        if (!batch.uid || batchIdByUid.has(batch.uid)) continue
        const batchId = store.insert(
          `INSERT INTO drug_batches
            (uid, drug_id, production_date, shelf_life_years, shelf_life_months, shelf_life_days,
             expiry_date, expiry_ack_date, qty_units, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batch.uid,
            drugId,
            batch.productionDate,
            batch.shelfLifeYears,
            batch.shelfLifeMonths,
            batch.shelfLifeDays,
            batch.expiryDate,
            batch.expiryAckDate,
            batch.qtyUnits,
            new Date().toISOString()
          ]
        )
        batchIdByUid.set(batch.uid, batchId)
      }
      recalcStock(store, drugId)
    }

    for (const combo of file.data.combos) {
      if (!combo.uid) continue
      const existing = store.queryOne<{ id: number }>(
        'SELECT id FROM medication_combos WHERE uid = ?',
        [combo.uid]
      )
      if (existing) {
        result.skipped += 1
        continue
      }
      const comboId = store.insert(
        'INSERT INTO medication_combos (uid, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [combo.uid, combo.name, combo.createdAt, combo.updatedAt]
      )
      combo.items.forEach((item, index) => {
        const sourceDrug = file.data.drugs.find((drug) => drug.id === item.drugId)
        const drugId = sourceDrug ? drugIdByUid.get(sourceDrug.uid) : undefined
        if (!drugId) return
        store.insert(
          'INSERT INTO medication_combo_items (combo_id, drug_id, qty, unit, sort_order) VALUES (?, ?, ?, ?, ?)',
          [comboId, drugId, item.qty, item.unit, index]
        )
      })
      result.combos += 1
    }

    for (const purchase of file.data.purchases) {
      if (!purchase.uid) continue
      const existing = store.queryOne<{ id: number }>(
        'SELECT id FROM purchases WHERE uid = ?',
        [purchase.uid]
      )
      if (existing) {
        result.skipped += 1
        continue
      }
      const sourceDrug = file.data.drugs.find((drug) => drug.id === purchase.drugId)
      const drugId = sourceDrug ? drugIdByUid.get(sourceDrug.uid) : undefined
      if (!drugId) continue
      store.insert(
        `INSERT INTO purchases (uid, drug_id, purchase_date, qty, unit_cost_cents, total_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase.uid,
          drugId,
          purchase.purchaseDate,
          purchase.qty,
          purchase.unitCostCents,
          purchase.totalCents,
          purchase.createdAt
        ]
      )
      result.purchases += 1
    }

    for (const prescription of file.data.prescriptions) {
      if (!prescription.uid) continue
      const existing = store.queryOne<{ id: number }>(
        'SELECT id FROM prescriptions WHERE uid = ?',
        [prescription.uid]
      )
      if (existing) {
        result.skipped += 1
        continue
      }
      const prescriptionId = store.insert(
        `INSERT INTO prescriptions
          (uid, patient_name, gender, age, diagnosis, issue_date, rp, doctor,
           drug_amount_cents, injection_fee_cents, fee_cents, total_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prescription.uid,
          prescription.patientName,
          prescription.gender,
          prescription.age,
          prescription.diagnosis,
          prescription.issueDate,
          prescription.rp,
          prescription.doctor,
          prescription.drugAmountCents,
          prescription.injectionFeeCents,
          prescription.feeCents,
          prescription.totalCents,
          prescription.createdAt,
          prescription.updatedAt
        ]
      )
      prescription.items.forEach((item, index) => {
        const sourceDrug = file.data.drugs.find((drug) => drug.id === item.drugId)
        const drugId = sourceDrug ? drugIdByUid.get(sourceDrug.uid) : undefined
        if (!drugId) return
        const batchId = item.batchUid ? batchIdByUid.get(item.batchUid) ?? 0 : 0
        store.insert(
          `INSERT INTO prescription_items
            (prescription_id, drug_id, drug_name, unit, unit_factor, qty, usage, frequency,
             group_key, group_name, group_usage, batch_id, unit_price_cents, unit_cost_cents,
             amount_cents, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prescriptionId,
            drugId,
            item.drugName,
            item.unit,
            item.unitFactor,
            item.qty,
            item.usage,
            item.frequency,
            item.groupKey,
            item.groupName,
            item.groupUsage,
            batchId,
            item.unitPriceCents,
            item.unitCostCents,
            item.amountCents,
            index
          ]
        )
      })
      result.prescriptions += 1
    }

    if (!service.getSettings().signatureImage && file.signatureImage) {
      service.setSettings({ signatureImage: file.signatureImage })
    }
  })
  return result
}
