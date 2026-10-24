import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatDrugStock, formatDrugUnitTotals } from '../../src/shared/drugUnits'
import { createTestContext, type TestContext } from '../helpers/testStore'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
})

afterEach(() => {
  ctx.cleanup()
})

describe('药品细分单位', () => {
  it('保存多级单位并按所选单位独立计价、扣基础库存', () => {
    const created = ctx.service.createDrug({
      name: '注射用阿莫西林',
      unit: '盒',
      inboundDate: '2026-10-01',
      stockQty: 5,
      warningQty: 2,
      category: '抗生素',
      supplier: '华康医药',
      indications: '',
      costCents: 1000,
      priceCents: 5000,
      units: [
        { unit: '支', factor: 7, priceCents: 800, costCents: 200 },
        { unit: 'mg', factor: 20, priceCents: 50, costCents: 15 }
      ]
    })
    const drug = ctx.service.getDrug(created.id)
    expect(drug.units.map((unit) => unit.unit)).toEqual(['支', 'mg'])
    expect(drug.units[0].priceCents).toBe(800)

    const result = ctx.service.createPrescription({
      patientName: '张三',
      gender: '男',
      age: '32',
      diagnosis: '感染',
      issueDate: '2026-10-24',
      doctor: '李医生',
      items: [{ drugId: created.id, unit: '支', qty: 1, usage: '静滴', frequency: '' }],
      injectionFeeCents: 0
    })
    const detail = ctx.service.getPrescription(result.id)
    expect(detail.items[0].unit).toBe('支')
    expect(detail.items[0].unitFactor).toBeCloseTo(1 / 7, 5)
    expect(detail.items[0].amountCents).toBe(800)
    const updated = ctx.service.getDrug(created.id)
    expect(updated.stockQty).toBeCloseTo(5 - 1 / 7, 5)
    expect(updated.stockUnits).toBe(680)
    expect(formatDrugStock(updated)).toBe('4盒 6支')
    expect(
      formatDrugStock({
        unit: '盒',
        stockQty: 10 + 4 / 6,
        units: [{ id: 1, unit: '支', factor: 6, priceCents: 100, costCents: 50 }]
      })
    ).toBe('10盒 4支')
    expect(
      formatDrugUnitTotals({
        unit: '盒',
        stockQty: 10,
        units: [
          { id: 1, unit: '板', factor: 2, priceCents: 100, costCents: 50 },
          { id: 2, unit: '片', factor: 6, priceCents: 10, costCents: 5 }
        ]
      })
    ).toBe('10盒 · 20板 · 120片')
  })

  it('多级单位库存按最细单位整数统计', () => {
    const created = ctx.service.createDrug({
      name: '盐酸克林霉素分散片',
      unit: '盒',
      inboundDate: '2026-10-01',
      stockQty: 10,
      warningQty: 2,
      category: '',
      supplier: '',
      indications: '',
      costCents: 100,
      priceCents: 200,
      units: [
        { unit: '板', factor: 2, priceCents: 20, costCents: 10 },
        { unit: '片', factor: 6, priceCents: 2, costCents: 1 }
      ]
    })
    const drug = ctx.service.getDrug(created.id)
    expect(drug.stockUnits).toBe(120)
    expect(formatDrugStock(drug)).toBe('10盒')
    expect(formatDrugUnitTotals(drug)).toBe('10盒 · 20板 · 120片')
  })
})
