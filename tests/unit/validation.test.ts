import { describe, expect, it } from 'vitest'
import {
  drugInputSchema,
  prescriptionInputSchema,
  purchaseInputSchema
} from '@shared/validation'

const validDrug = {
  name: '阿莫西林胶囊',
  unit: '盒',
  inboundDate: '2026-10-01',
  stockQty: 10,
  warningQty: 5,
  category: '抗生素',
  supplier: '华康医药',
  indications: '用于感染',
  costCents: 800,
  priceCents: 1800
}

const validPrescription = {
  patientName: '张秀兰',
  gender: '女',
  age: '62',
  diagnosis: '高血压',
  issueDate: '2026-10-23',
  rp: '低盐饮食',
  doctor: '王医生',
  items: [{ drugId: 1, qty: 2, usage: '口服', frequency: '每日1次' }],
  injectionFeeCents: 2000
}

describe('validation', () => {
  it('合法药品通过', () => {
    expect(drugInputSchema.parse(validDrug).name).toBe('阿莫西林胶囊')
  })

  it('药品必填与未来日期被拒绝', () => {
    expect(() => drugInputSchema.parse({ ...validDrug, name: '' })).toThrow()
    expect(() => drugInputSchema.parse({ ...validDrug, inboundDate: '2999-01-01' })).toThrow()
    expect(() => drugInputSchema.parse({ ...validDrug, stockQty: -1 })).toThrow()
    expect(() => drugInputSchema.parse({ ...validDrug, unit: '' })).toThrow()
  })

  it('处方至少一种药、Rp 不超过 500 字', () => {
    expect(prescriptionInputSchema.parse(validPrescription).items).toHaveLength(1)
    expect(() =>
      prescriptionInputSchema.parse({ ...validPrescription, items: [] })
    ).toThrow()
    expect(() =>
      prescriptionInputSchema.parse({ ...validPrescription, rp: '字'.repeat(501) })
    ).toThrow()
    expect(() =>
      prescriptionInputSchema.parse({ ...validPrescription, gender: '其他' })
    ).toThrow()
  })

  it('进货数量与成本校验', () => {
    expect(
      purchaseInputSchema.parse({
        drugId: 1,
        purchaseDate: '2026-10-23',
        qty: 5,
        unitCostCents: 850
      }).qty
    ).toBe(5)
    expect(() =>
      purchaseInputSchema.parse({
        drugId: 1,
        purchaseDate: '2026-10-23',
        qty: 0,
        unitCostCents: 850
      })
    ).toThrow()
    expect(() =>
      purchaseInputSchema.parse({
        drugId: 1,
        purchaseDate: '2026-10-23',
        qty: 1,
        unitCostCents: -1
      })
    ).toThrow()
  })
})
