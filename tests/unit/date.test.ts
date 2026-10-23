import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatPeriodLabel,
  getGroupKey,
  getGroupLabel,
  getPeriodRange,
  isValidIsoDate,
  parseIsoDate,
  shiftPeriod,
  startOfWeekMonday,
  toIsoDate
} from '@shared/date'

describe('date', () => {
  it('周一为一周起点', () => {
    expect(startOfWeekMonday('2026-10-23')).toBe('2026-10-19')
    expect(startOfWeekMonday('2026-10-19')).toBe('2026-10-19')
    expect(startOfWeekMonday('2026-10-25')).toBe('2026-10-19')
  })

  it('日/周/月/年范围', () => {
    expect(getPeriodRange('day', '2026-10-23')).toEqual({
      from: '2026-10-23',
      to: '2026-10-23'
    })
    expect(getPeriodRange('week', '2026-10-23')).toEqual({
      from: '2026-10-19',
      to: '2026-10-25'
    })
    expect(getPeriodRange('month', '2026-10-23')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31'
    })
    expect(getPeriodRange('month', '2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28'
    })
    expect(getPeriodRange('year', '2026-10-23')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31'
    })
  })

  it('周期翻页', () => {
    expect(shiftPeriod('day', '2026-10-23', 1)).toBe('2026-10-24')
    expect(shiftPeriod('week', '2026-10-23', -1)).toBe('2026-10-16')
    expect(shiftPeriod('month', '2026-10-23', 1)).toBe('2026-11-23')
    expect(shiftPeriod('year', '2026-10-23', -1)).toBe('2025-10-23')
  })

  it('日期校验与计算', () => {
    expect(isValidIsoDate('2026-10-23')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026/10/23')).toBe(false)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(toIsoDate(parseIsoDate('2026-10-23'))).toBe('2026-10-23')
  })

  it('分组与展示标签', () => {
    expect(getGroupKey('year', '2026-10-23')).toBe('2026-10')
    expect(getGroupKey('month', '2026-10-23')).toBe('2026-10-23')
    expect(getGroupLabel('month', '2026-10-23')).toBe('10-23')
    expect(getGroupLabel('year', '2026-10')).toBe('2026年10月')
    expect(formatPeriodLabel('week', '2026-10-23')).toContain('2026年10月19日')
  })
})
