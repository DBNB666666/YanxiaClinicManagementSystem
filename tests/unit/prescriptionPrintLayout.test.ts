import { describe, expect, it } from 'vitest'
import type { PrescriptionDetail } from '../../src/shared/types/models'
import { buildPrescriptionHeaderFields } from '../../src/shared/prescriptionPrintLayout'

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
})
