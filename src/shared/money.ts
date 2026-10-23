const CNY = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/** 元 -> 分，四舍五入到整数分。 */
export function toCents(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('金额格式不正确')
    return Math.round(value * 100)
  }
  const normalized = value.replace(/[¥￥,\s]/g, '').trim()
  if (!normalized) throw new Error('金额不能为空')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) throw new Error('金额格式不正确')
  return Math.round(parsed * 100)
}

export function centsToYuan(cents: number): number {
  return Math.round(cents) / 100
}

/** 用于输入框显示，保留两位小数，不带货币符号。 */
export function centsToInput(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2)
}

/** 用于界面显示：¥1,234.00 */
export function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0
  return `¥${CNY.format(safe / 100)}`
}

/** 盈利显示：正数加 +，负数带 -，零为 ¥0.00。 */
export function formatProfit(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`
  return formatCents(cents)
}

export function multiplyCents(qty: number, unitCents: number): number {
  return Math.round(qty) * Math.round(unitCents)
}

export function sumCents(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value), 0)
}
