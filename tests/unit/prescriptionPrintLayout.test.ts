import { describe, expect, it } from 'vitest'
import type { PrescriptionDetail } from '../../src/shared/types/models'
import {
  PRINT_CONTENT_LAYOUT,
  PRINT_CONTENT_MAX_LINES,
  buildPrescriptionContentLines,
  buildPrescriptionFooterFields,
  buildPrescriptionHeaderFields,
  buildPrescriptionSignatureField
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
  feeCents: 900,
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
    expect(lines).toEqual(['1、阿莫西林胶囊  2盒', '    用法：口服，每日1次'])
    expect(lines.join('')).not.toContain('1.')
  })

  it('组合用药按一个编号、组内缩进、组下共用一行用法打印', () => {
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
          usage: '',
          frequency: '',
          groupKey: 'combo-1',
          groupName: '感冒组合',
          groupUsage: '口服，每天3次',
          unitPriceCents: 0,
          unitCostCents: 0,
          amountCents: 0
        },
        {
          id: 2,
          prescriptionId: 1,
          drugId: 2,
          drugName: '布洛芬缓释胶囊',
          unit: '盒',
          qty: 1,
          usage: '',
          frequency: '',
          groupKey: 'combo-1',
          groupName: '感冒组合',
          groupUsage: '口服，每天3次',
          unitPriceCents: 0,
          unitCostCents: 0,
          amountCents: 0
        }
      ]
    } as PrescriptionDetail)
    expect(lines).toEqual([
      '1、阿莫西林胶囊  2盒',
      '   布洛芬缓释胶囊  1盒',
      '    用法：口服，每天3次'
    ])
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

  it('医师签名回到下方“医师”栏位置', () => {
    const footer = buildPrescriptionFooterFields(detail, true)
    expect(footer.some((field) => field.key === 'doctor')).toBe(false)
    const signature = buildPrescriptionSignatureField(detail, 4)
    expect(signature.x).toBeCloseTo(0.675, 3)
    expect(signature.y).toBeCloseTo(0.744, 3)
  })
})
