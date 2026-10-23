import type { FinancePeriod } from './types/models'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) throw new Error(`日期格式不正确：${iso}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`日期不存在：${iso}`)
  }
  return date
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function isValidIsoDate(value: string): boolean {
  try {
    parseIsoDate(value)
    return true
  } catch {
    return false
  }
}

export function isFutureDate(iso: string): boolean {
  const today = todayIso()
  return iso > today
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function startOfWeekMonday(iso: string): string {
  const date = parseIsoDate(iso)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  return toIsoDate(date)
}

export function endOfWeekSunday(iso: string): string {
  return addDays(startOfWeekMonday(iso), 6)
}

export interface DateRange {
  from: string
  to: string
}

export function getPeriodRange(period: FinancePeriod, anchorDate: string): DateRange {
  const date = parseIsoDate(anchorDate)
  if (period === 'day') {
    return { from: anchorDate, to: anchorDate }
  }
  if (period === 'week') {
    return { from: startOfWeekMonday(anchorDate), to: endOfWeekSunday(anchorDate) }
  }
  if (period === 'month') {
    const from = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
    return { from, to: toIsoDate(last) }
  }
  return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` }
}

export function shiftPeriod(period: FinancePeriod, anchorDate: string, delta: number): string {
  const date = parseIsoDate(anchorDate)
  if (period === 'day') {
    date.setDate(date.getDate() + delta)
  } else if (period === 'week') {
    date.setDate(date.getDate() + delta * 7)
  } else if (period === 'month') {
    date.setMonth(date.getMonth() + delta)
  } else {
    date.setFullYear(date.getFullYear() + delta)
  }
  return toIsoDate(date)
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

export function formatDateCn(iso: string, withWeekday = false): string {
  const date = parseIsoDate(iso)
  const base = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  return withWeekday ? `${base} 星期${WEEKDAY_CN[date.getDay()]}` : base
}

export function formatPeriodLabel(period: FinancePeriod, anchorDate: string): string {
  if (period === 'day') return formatDateCn(anchorDate, true)
  if (period === 'week') {
    const range = getPeriodRange('week', anchorDate)
    return `${formatDateCn(range.from)} – ${formatDateCn(range.to)}`
  }
  const date = parseIsoDate(anchorDate)
  if (period === 'month') return `${date.getFullYear()}年${date.getMonth() + 1}月`
  return `${date.getFullYear()}年`
}

export function getGroupKey(period: FinancePeriod, issueDate: string): string {
  if (period === 'year') return issueDate.slice(0, 7)
  return issueDate
}

export function getGroupLabel(period: FinancePeriod, key: string): string {
  if (period === 'year') {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
  }
  const date = parseIsoDate(key)
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${toIsoDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
