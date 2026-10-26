import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteStore } from '../../src/main/db/store'
import { ClinicService } from '../../src/main/services/clinicService'

export interface TestContext {
  dir: string
  store: SqliteStore
  service: ClinicService
  cleanup: () => void
}

export async function createTestContext(): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), 'yanxia-test-'))
  const store = await SqliteStore.open({ dbPath: join(dir, 'clinic.db'), persist: true })
  const service = new ClinicService(store)
  return {
    dir,
    store,
    service,
    cleanup: () => {
      try {
        store.close()
      } catch {
        // ignore
      }
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

export function seedBase(service: ClinicService): void {
  service.createDrug({
    name: '阿莫西林胶囊',
    unit: '盒',
    inboundDate: '2026-10-01',
    stockQty: 10,
    warningQty: 5,
    category: '抗生素',
    supplier: '华康医药',
    indications: '用于敏感菌感染',
    costCents: 800,
    priceCents: 1800
  })
  service.createDrug({
    name: '布洛芬缓释胶囊',
    unit: '盒',
    inboundDate: '2026-09-28',
    stockQty: 3,
    warningQty: 5,
    category: '解热镇痛',
    supplier: '华康医药',
    indications: '用于发热疼痛',
    costCents: 500,
    priceCents: 1200
  })
  service.createDrug({
    name: '生理盐水',
    unit: '瓶',
    inboundDate: '2026-09-20',
    stockQty: 0,
    warningQty: 5,
    category: '输液',
    supplier: '康源',
    indications: '补液',
    costCents: 200,
    priceCents: 500
  })
  service.createDrug({
    name: '创可贴',
    unit: '包',
    inboundDate: '2026-09-10',
    stockQty: 20,
    warningQty: 20,
    category: '外用',
    supplier: '康源',
    indications: '小创口',
    costCents: 100,
    priceCents: 300
  })
  service.markAllNotificationsRead()
}

export const P1 = {
  patientName: '张秀兰',
  gender: '女' as const,
  age: '62',
  diagnosis: '高血压、失眠',
  issueDate: '2026-10-23',
  rp: '注意休息，低盐饮食。',
  doctor: '王医生',
  items: [
    { drugId: 1, qty: 2, usage: '口服', frequency: '每日1次' },
    { drugId: 2, qty: 1, usage: '口服', frequency: '每日2次' }
  ],
  injectionFeeCents: 2000,
  feeCents: 6800
}

export const P2 = {
  patientName: '李国强',
  gender: '男' as const,
  age: '45',
  diagnosis: '急性支气管炎',
  issueDate: '2026-10-22',
  rp: '多饮水，注意休息。',
  doctor: '王医生',
  items: [
    { drugId: 1, qty: 1, usage: '口服', frequency: '每日3次' },
    { drugId: 2, qty: 1, usage: '口服', frequency: '每日2次' },
    { drugId: 3, qty: 1, usage: '静脉滴注', frequency: '每日1次' }
  ],
  injectionFeeCents: 0,
  feeCents: 3500
}

export const P3 = {
  patientName: '王小明',
  gender: '男' as const,
  age: '8个月',
  diagnosis: '上呼吸道感染',
  issueDate: '2026-10-21',
  rp: '按医嘱服用。',
  doctor: '李医生',
  items: [{ drugId: 1, qty: 2, usage: '口服', frequency: '每日2次' }],
  injectionFeeCents: 0,
  manualDrugAmountCents: 3000,
  feeCents: 3000
}
