export interface ShelfLife {
  years: number
  months: number
  days: number
}

export interface ProductionParts {
  year: number
  month: number
  day: number | null
}

export function parseProductionDate(value: string): ProductionParts | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = match[3] ? Number(match[3]) : null
  if (month < 1 || month > 12) return null
  if (day !== null && (day < 1 || day > 31)) return null
  return { year, month, day }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`
}

export function computeExpiryDate(
  productionDate: string,
  shelfLife: ShelfLife
): string {
  const parts = parseProductionDate(productionDate)
  if (!parts) return ''
  const day = Math.min(parts.day ?? 1, daysInMonth(parts.year, parts.month))
  let year = parts.year + Math.max(0, shelfLife.years)
  let month = parts.month + Math.max(0, shelfLife.months)
  year += Math.floor((month - 1) / 12)
  month = ((month - 1) % 12) + 1
  const clampedDay = Math.min(day, daysInMonth(year, month))
  const date = new Date(Date.UTC(year, month - 1, clampedDay))
  date.setUTCDate(date.getUTCDate() + Math.max(0, shelfLife.days))
  return formatDate(date)
}

export function daysUntil(date: string, today = formatDate(new Date())): number {
  const target = Date.parse(`${date}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(target) || !Number.isFinite(current)) return Number.POSITIVE_INFINITY
  return Math.ceil((target - current) / 86_400_000)
}

export function isExpiryWarning(
  expiryDate: string,
  ackDate: string,
  today = formatDate(new Date()),
  warningDays = 45
): boolean {
  if (!expiryDate || ackDate === expiryDate) return false
  return daysUntil(expiryDate, today) <= warningDays
}
