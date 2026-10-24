import { describe, expect, it } from 'vitest'
import type { PrescriptionDetail } from '../../src/shared/types/models'
import {
  PRINT_CONTENT_LAYOUT,
  PRINT_CONTENT_MAX_LINES,
  buildPrescriptionContentLines,
  buildPrescriptionFooterFields,
  buildPrescriptionHeaderFields
} from '../../src/shared/prescriptionPrintLayout'

const detail = {
  id: 1,
  patientName: '张三',
  gender: '男',
  age: '62',
  diagnosis: '咽喉发炎',
  issueDate: '2026-10-24',
  rp: '',
  doctor: '华佗',
  drugAmountCents: 900,
  injectionFeeCents: 0,
  totalCents: 900,
  costCents: 800,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  items: []
} satisfies PrescriptionDetail

describe('prescription print layout', () => {
  it('年龄数值位于“年龄”标签右侧的横线上', () => {
    const age = buildPrescriptionHeaderFields(detail).find((field) => field.key === 'age')
    expect(age).toBeDefined()
    expect(age!.x).toBeGreaterThanOrEqual(0.7)
    expect(age!.y).toBeGreaterThanOrEqual(0.128)
  })

  it('打印用药按规范分为药名/数量行与用法行', () => {
    const lines = buildPrescriptionContentLines({
      ...detail,
      items: [
        {
          id: 1,
          prescriptionId: 1,
          drugId: 1,
          drugName: '阿莫西林胶囊',
          unit: '盒',
          qty: 2,
          usage: '口服',
          frequency: '每日1次',
          unitPriceCents: 1800,
          unitCostCents: 800,
          amountCents: 3600
        }
      ]
    } as PrescriptionDetail)
    expect(lines).toEqual(['    阿莫西林胶囊    2盒', '        用法：口服    每日1次'])
    expect(lines.join('')).not.toContain('1.')
  })

  it('打印内容不再输出 Rp 正文/嘱托', () => {
    const lines = buildPrescriptionContentLines({ ...detail, rp: '注意休息，低盐饮食。' })
    expect(lines.join('')).not.toContain('嘱托')
    expect(lines.join('')).not.toContain('注意休息')
  })

  it('Rp 用药内容整体位于 Rp 标题下方且不压到底部费用区', () => {
    expect(PRINT_CONTENT_LAYOUT.y).toBeGreaterThanOrEqual(0.31)
    const lastLineBottom =
      PRINT_CONTENT_LAYOUT.y + (PRINT_CONTENT_MAX_LINES - 1) * PRINT_CONTENT_LAYOUT.lineHeight
    expect(lastLineBottom).toBeLessThan(0.7)
  })

  it('医师姓名位于“医师”标签同一行右侧、签名横线上方', () => {
    const doctor = buildPrescriptionFooterFields(detail, true).find((field) => field.key === 'doctor')
    expect(doctor).toBeDefined()
    expect(doctor!.x).toBeGreaterThanOrEqual(0.65)
    expect(doctor!.y).toBeLessThan(0.75)
  })
})
