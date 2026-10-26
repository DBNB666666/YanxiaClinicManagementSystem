import { describe, expect, it } from 'vitest'
import { computeExpiryDate, daysUntil, isExpiryWarning } from '../../src/shared/expiry'

describe('drug expiry', () => {
  it('计算年月天组合的到期日', () => {
    expect(
      computeExpiryDate('2024-01-15', { years: 2, months: 1, days: 10 })
    ).toBe('2026-02-25')
  })

  it('生产日期无日时按当月1日计算', () => {
    expect(computeExpiryDate('2025-10', { years: 1, months: 0, days: 0 })).toBe(
      '2026-10-01'
    )
  })

  it('45天内才提醒，确认后不再提醒', () => {
    expect(isExpiryWarning('2026-12-01', '', '2026-10-17')).toBe(true)
    expect(isExpiryWarning('2026-12-01', '', '2026-10-16')).toBe(false)
    expect(isExpiryWarning('2026-12-01', '2026-12-01', '2026-11-01')).toBe(false)
    expect(daysUntil('2026-12-01', '2026-10-17')).toBe(45)
  })
})
