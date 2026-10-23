import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SqliteStore } from '../../src/main/db/store'
import { ClinicService } from '../../src/main/services/clinicService'

describe('sqlite persistence', () => {
  it('关闭后重新打开，药品与设置仍在', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yanxia-persist-'))
    try {
      const dbPath = join(dir, 'clinic.db')
      const firstStore = await SqliteStore.open({ dbPath })
      const firstService = new ClinicService(firstStore)
      const created = firstService.createDrug({
        name: '持久化测试药',
        unit: '盒',
        inboundDate: '2026-10-01',
        stockQty: 7,
        warningQty: 2,
        category: '测试',
        supplier: '测试',
        indications: '测试',
        costCents: 100,
        priceCents: 300
      })
      firstService.setSettings({ theme: 'reading', lastDoctor: '持久化医生' })
      firstStore.close()

      const secondStore = await SqliteStore.open({ dbPath })
      const secondService = new ClinicService(secondStore)
      const drug = secondService.getDrug(created.id)
      expect(drug.name).toBe('持久化测试药')
      expect(drug.stockQty).toBe(7)
      expect(secondService.getSettings().theme).toBe('reading')
      expect(secondService.getSettings().lastDoctor).toBe('持久化医生')
      secondStore.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
