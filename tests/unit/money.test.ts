import { describe, expect, it } from 'vitest'
import {
  centsToInput,
  centsToYuan,
  formatCents,
  formatProfit,
  multiplyCents,
  sumCents,
  toCents
} from '@shared/money'

describe('money', () => {
  it('元转分支持字符串、货币符号和千分位', () => {
    expect(toCents('18')).toBe(1800)
    expect(toCents('18.5')).toBe(1850)
    expect(toCents('¥1,234.56')).toBe(123456)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })

  it('非法金额抛出错误', () => {
    expect(() => toCents('abc')).toThrow()
    expect(() => toCents('')).toThrow()
    expect(() => toCents(Number.NaN)).toThrow()
  })

  it('分转元与输入格式', () => {
    expect(centsToYuan(1800)).toBe(18)
    expect(centsToInput(1800)).toBe('18.00')
    expect(centsToInput(5)).toBe('0.05')
  })

  it('显示格式与盈利符号', () => {
    expect(formatCents(123456)).toBe('¥1,234.56')
    expect(formatCents(0)).toBe('¥0.00')
    expect(formatProfit(5600)).toBe('+¥56.00')
    expect(formatProfit(-600)).toBe('¥-6.00')
    expect(formatProfit(0)).toBe('¥0.00')
  })

  it('数量乘单价与求和使用整数分', () => {
    expect(multiplyCents(2, 1800)).toBe(3600)
    expect(sumCents([3600, 1200, 0])).toBe(4800)
  })
})
