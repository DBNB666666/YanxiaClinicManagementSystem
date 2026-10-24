import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/result'
import type { PrescriptionInput } from '@shared/types/models'
import { createTestContext, P1, P2, P3, seedBase, type TestContext } from '../helpers/testStore'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
  seedBase(ctx.service)
})

afterEach(() => {
  ctx.cleanup()
})

function simplePrescription(overrides: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    patientName: '测试患者',
    gender: '女',
    age: '30',
    diagnosis: '测试诊断',
    issueDate: '2026-10-23',
    rp: '测试 Rp',
    doctor: '王医生',
    items: [{ drugId: 1, qty: 1, usage: '口服', frequency: '每日1次' }],
    injectionFeeCents: 0,
    ...overrides
  }
}

describe('药品', () => {
  it('新增、列表、搜索与低库存筛选', () => {
    const list = ctx.service.listDrugs({ page: 1, pageSize: 20 })
    expect(list.total).toBe(4)
    expect(list.items.map((item) => item.name)).toContain('阿莫西林胶囊')

    const searched = ctx.service.listDrugs({ query: '阿莫', page: 1, pageSize: 20 })
    expect(searched.total).toBe(1)
    expect(searched.items[0].name).toBe('阿莫西林胶囊')

    const low = ctx.service.listDrugs({ filter: 'low', page: 1, pageSize: 20 })
    expect(low.total).toBe(3)
    expect(low.items.every((item) => item.stockQty <= item.warningQty)).toBe(true)
  })

  it('进货增加库存并更新成本，历史处方快照不变', () => {
    const p1 = ctx.service.createPrescription(P1)
    const before = ctx.service.getPrescription(p1.id)
    const purchase = ctx.service.purchaseDrug({
      drugId: 1,
      purchaseDate: '2026-10-23',
      qty: 5,
      unitCostCents: 850
    })
    expect(purchase.stockQty).toBe(13)
    expect(purchase.costCents).toBe(850)
    const detail = ctx.service.getDrug(1)
    expect(detail.stockQty).toBe(13)
    expect(detail.costCents).toBe(850)
    expect(detail.purchases).toHaveLength(1)
    expect(detail.purchases[0].totalCents).toBe(4250)
    expect(before.items.find((item) => item.drugId === 1)?.unitCostCents).toBe(800)
  })

  it('已用药品不能删除，停用后不能进货', () => {
    ctx.service.createPrescription(P1)
    expect(() => ctx.service.deleteDrug(1)).toThrowError(AppError)
    ctx.service.setDrugStatus(1, 'stopped')
    expect(ctx.service.getDrug(1).status).toBe('stopped')
    expect(ctx.service.listDrugs({ filter: 'stopped', page: 1, pageSize: 20 }).total).toBe(1)
    expect(() =>
      ctx.service.purchaseDrug({
        drugId: 1,
        purchaseDate: '2026-10-23',
        qty: 1,
        unitCostCents: 800
      })
    ).toThrowError(AppError)
  })

  it('未使用且无进货的药品可以删除', () => {
    const created = ctx.service.createDrug({
      name: '维生素C片',
      unit: '瓶',
      inboundDate: '2026-10-01',
      stockQty: 6,
      warningQty: 5,
      category: '维生素',
      supplier: '测试',
      indications: '补充维生素',
      costCents: 300,
      priceCents: 600
    })
    expect(ctx.service.getDrug(created.id).name).toBe('维生素C片')
    ctx.service.deleteDrug(created.id)
    expect(ctx.service.listDrugs({ page: 1, pageSize: 20 }).total).toBe(4)
  })
})

describe('处方', () => {
  it('创建处方扣库存并自动算金额/成本', () => {
    const result = ctx.service.createPrescription(P1)
    expect(result.warnings).toEqual([])
    expect(ctx.service.getDrug(1).stockQty).toBe(8)
    expect(ctx.service.getDrug(2).stockQty).toBe(2)
    const detail = ctx.service.getPrescription(result.id)
    expect(detail.drugAmountCents).toBe(4800)
    expect(detail.injectionFeeCents).toBe(2000)
    expect(detail.totalCents).toBe(6800)
    expect(detail.costCents).toBe(2100)
    expect(detail.items).toHaveLength(2)
    expect(detail.items.find((item) => item.drugId === 1)?.amountCents).toBe(3600)
    expect(ctx.service.listPrescriptions({ page: 1, pageSize: 20 }).items[0].medicationText).toContain(
      '阿莫西林胶囊'
    )
  })

  it('库存不足默认拒绝，允许负数后保存', () => {
    expect(() => ctx.service.createPrescription(P2)).toThrowError(AppError)
    const result = ctx.service.createPrescription(P2, true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(ctx.service.getDrug(3).stockQty).toBe(-1)
    const detail = ctx.service.getPrescription(result.id)
    expect(detail.drugAmountCents).toBe(3500)
    expect(detail.costCents).toBe(1500)
  })

  it('编辑数量按差额调整库存并重算', () => {
    const created = ctx.service.createPrescription(P1)
    const detail = ctx.service.getPrescription(created.id)
    const items = detail.items.map((item) => ({
      id: item.id,
      drugId: item.drugId,
      qty: item.drugId === 1 ? 3 : item.qty,
      usage: item.usage,
      frequency: item.frequency
    }))
    ctx.service.updatePrescription(
      created.id,
      {
        ...P1,
        items
      },
      false
    )
    expect(ctx.service.getDrug(1).stockQty).toBe(7)
    const updated = ctx.service.getPrescription(created.id)
    expect(updated.drugAmountCents).toBe(6600)
    expect(updated.costCents).toBe(2900)
    expect(updated.totalCents).toBe(8600)
  })

  it('只修改患者信息不扣减库存', () => {
    const created = ctx.service.createPrescription(P1)
    expect(ctx.service.getDrug(1).stockQty).toBe(8)
    expect(ctx.service.getDrug(2).stockQty).toBe(2)
    const detail = ctx.service.getPrescription(created.id)
    ctx.service.updatePrescription(created.id, {
      ...P1,
      patientName: '张秀兰改',
      items: detail.items.map((item) => ({
        id: item.id,
        drugId: item.drugId,
        unit: item.unit,
        qty: item.qty,
        usage: item.usage,
        frequency: item.frequency
      }))
    })
    expect(ctx.service.getDrug(1).stockQty).toBe(8)
    expect(ctx.service.getDrug(2).stockQty).toBe(2)
    expect(ctx.service.getPrescription(created.id).patientName).toBe('张秀兰改')
  })

  it('删除处方退回库存并从财务移除', () => {
    const created = ctx.service.createPrescription(P1)
    expect(ctx.service.getDrug(1).stockQty).toBe(8)
    ctx.service.deletePrescription(created.id)
    expect(ctx.service.getDrug(1).stockQty).toBe(10)
    expect(ctx.service.getDrug(2).stockQty).toBe(3)
    expect(ctx.service.listPrescriptions({ page: 1, pageSize: 20 }).total).toBe(0)
    const finance = ctx.service.financeSummary({ period: 'day', anchorDate: '2026-10-23' })
    expect(finance.summary.count).toBe(0)
  })

  it('改药价不影响旧处方快照', () => {
    const created = ctx.service.createPrescription(P1)
    const drug = ctx.service.getDrug(1)
    ctx.service.updateDrug(1, {
      name: drug.name,
      unit: drug.unit,
      inboundDate: drug.inboundDate,
      stockQty: drug.stockQty,
      warningQty: drug.warningQty,
      category: drug.category,
      supplier: drug.supplier,
      indications: drug.indications,
      costCents: drug.costCents,
      priceCents: 2000
    })
    const detail = ctx.service.getPrescription(created.id)
    const item = detail.items.find((entry) => entry.drugId === 1)!
    expect(item.unitPriceCents).toBe(1800)
    expect(item.amountCents).toBe(3600)
    expect(detail.drugAmountCents).toBe(4800)
  })

  it('手动药品金额只影响收费，不影响成本', () => {
    const created = ctx.service.createPrescription(P3)
    const detail = ctx.service.getPrescription(created.id)
    expect(detail.drugAmountCents).toBe(3000)
    expect(detail.costCents).toBe(1600)
    expect(detail.totalCents).toBe(3000)
  })

  it('必填校验失败时不落库', () => {
    expect(() =>
      ctx.service.createPrescription({
        ...simplePrescription(),
        patientName: ''
      })
    ).toThrow()
    expect(ctx.service.listPrescriptions({ page: 1, pageSize: 20 }).total).toBe(0)
  })
})

describe('财务', () => {
  beforeEach(() => {
    ctx.service.createPrescription(P1)
    ctx.service.createPrescription(P2, true)
    ctx.service.createPrescription(P3)
  })

  it('日账本只统计当天', () => {
    const result = ctx.service.financeSummary({ period: 'day', anchorDate: '2026-10-23' })
    expect(result.summary).toEqual({
      revenueCents: 6800,
      costCents: 2100,
      profitCents: 4700,
      count: 1
    })
  })

  it('周账本按周一到周日汇总', () => {
    const result = ctx.service.financeSummary({ period: 'week', anchorDate: '2026-10-23' })
    expect(result.summary).toEqual({
      revenueCents: 13300,
      costCents: 5200,
      profitCents: 8100,
      count: 3
    })
    expect(result.rows.map((row) => row.key)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23'])
  })

  it('月/年汇总与明细', () => {
    const month = ctx.service.financeSummary({ period: 'month', anchorDate: '2026-10-23' })
    const year = ctx.service.financeSummary({ period: 'year', anchorDate: '2026-10-23' })
    expect(month.summary).toEqual(year.summary)
    const details = ctx.service.financeDetails({
      period: 'month',
      anchorDate: '2026-10-23',
      key: '2026-10-23'
    })
    expect(details.items).toHaveLength(1)
    expect(details.items[0].patientName).toBe('张秀兰')
  })

  it('负盈利按收入减成本计算', () => {
    ctx.service.createPrescription({
      patientName: '负盈利患者',
      gender: '男',
      age: '40',
      diagnosis: '测试',
      issueDate: '2026-10-20',
      rp: '测试',
      doctor: '王医生',
      items: [{ drugId: 1, qty: 1, usage: '口服', frequency: '每日1次' }],
      injectionFeeCents: 0,
      manualDrugAmountCents: 500
    })
    const day = ctx.service.financeSummary({ period: 'day', anchorDate: '2026-10-20' })
    expect(day.summary).toEqual({
      revenueCents: 500,
      costCents: 800,
      profitCents: -300,
      count: 1
    })
  })
})

describe('通知', () => {
  it('库存到预警值生成未读，重复不刷屏，补货自动已读', () => {
    expect(ctx.service.unreadNotificationCount().count).toBe(0)
    ctx.service.createPrescription(
      simplePrescription({ items: [{ drugId: 1, qty: 5, usage: '口服', frequency: '每日1次' }] })
    )
    expect(ctx.service.getDrug(1).stockQty).toBe(5)
    expect(ctx.service.unreadNotificationCount().count).toBe(1)

    ctx.service.createPrescription(
      simplePrescription({ items: [{ drugId: 1, qty: 1, usage: '口服', frequency: '每日1次' }] })
    )
    expect(ctx.service.unreadNotificationCount().count).toBe(1)

    ctx.service.purchaseDrug({
      drugId: 1,
      purchaseDate: '2026-10-23',
      qty: 2,
      unitCostCents: 800
    })
    expect(ctx.service.getDrug(1).stockQty).toBe(6)
    expect(ctx.service.unreadNotificationCount().count).toBe(0)
  })
})

describe('设置与备份', () => {
  it('设置可读写', () => {
    const updated = ctx.service.setSettings({ theme: 'dark', lastDoctor: '王医生' })
    expect(updated.theme).toBe('dark')
    expect(ctx.service.getSettings().lastDoctor).toBe('王医生')
  })
})
