import type { PrescriptionDetail } from './types/models'
import { formatCents } from './money'

export const PRINT_PAGE_WIDTH_MM = 130
export const PRINT_PAGE_HEIGHT_MM = 190
export const PRINT_PAGE_WIDTH_PX = Math.round((PRINT_PAGE_WIDTH_MM / 25.4) * 96)
export const PRINT_PAGE_HEIGHT_PX = Math.round((PRINT_PAGE_HEIGHT_MM / 25.4) * 96)
export const PRINT_CONTENT_MAX_CHARS = 30
export const PRINT_CONTENT_MAX_LINES = 15
export const PRINT_CONTENT_LAYOUT = {
  x: 0.1,
  y: 0.3,
  width: 0.82,
  lineHeight: 0.0245,
  fontSize: 9
}

export interface PrintField {
  key: string
  text: string
  x: number
  y: number
  width: number
  size: number
  align?: 'left' | 'right' | 'center'
}

export function formatPrintAmount(cents: number): string {
  return formatCents(cents).replace('¥', '')
}

export function formatChineseDate(iso: string): { year: string; month: string; day: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return { year: iso, month: '', day: '' }
  return { year: match[1], month: match[2], day: match[3] }
}

export function buildPrescriptionHeaderFields(prescription: PrescriptionDetail): PrintField[] {
  const date = formatChineseDate(prescription.issueDate)
  return [
    { key: 'name', text: prescription.patientName, x: 0.205, y: 0.124, width: 0.20, size: 10 },
    { key: 'gender', text: prescription.gender, x: 0.49, y: 0.124, width: 0.08, size: 10 },
    { key: 'age', text: prescription.age, x: 0.72, y: 0.13, width: 0.16, size: 10 },
    { key: 'diagnosis', text: prescription.diagnosis, x: 0.245, y: 0.195, width: 0.69, size: 10 },
    { key: 'year', text: date.year, x: 0.255, y: 0.227, width: 0.14, size: 9 },
    { key: 'month', text: date.month, x: 0.505, y: 0.227, width: 0.07, size: 9 },
    { key: 'day', text: date.day, x: 0.585, y: 0.227, width: 0.07, size: 9 }
  ]
}

export function buildPrescriptionFooterFields(
  prescription: PrescriptionDetail,
  showFees: boolean
): PrintField[] {
  const fields: PrintField[] = []
  if (showFees) {
    fields.push(
      {
        key: 'drug-amount',
        text: formatPrintAmount(prescription.drugAmountCents),
        x: 0.305,
        y: 0.792,
        width: 0.18,
        size: 9
      },
      {
        key: 'injection-fee',
        text: formatPrintAmount(prescription.injectionFeeCents),
        x: 0.305,
        y: 0.827,
        width: 0.18,
        size: 9
      },
      {
        key: 'doctor',
        text: prescription.doctor,
        x: 0.675,
        y: 0.771,
        width: 0.22,
        size: 10
      }
    )
  }
  return fields
}

export function buildPrescriptionContentLines(prescription: PrescriptionDetail): string[] {
  const lines: string[] = []
  prescription.items.forEach((item, index) => {
    const usage = [item.usage, item.frequency].filter(Boolean).join(' / ')
    const line = `${index + 1}. ${item.drugName}  ${item.qty}${item.unit}${usage ? `  ${usage}` : ''}`
    lines.push(...wrapByChars(line))
  })
  if (prescription.rp.trim()) {
    lines.push(...wrapByChars(`嘱托：${prescription.rp.trim()}`))
  }
  return lines
}

export function getPrescriptionPages(prescription: PrescriptionDetail): string[][] {
  const lines = buildPrescriptionContentLines(prescription)
  if (lines.length === 0) return [[]]
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += PRINT_CONTENT_MAX_LINES) {
    pages.push(lines.slice(index, index + PRINT_CONTENT_MAX_LINES))
  }
  return pages
}

export function countPrescriptionPages(prescriptions: PrescriptionDetail[]): number {
  return prescriptions.reduce((total, prescription) => total + getPrescriptionPages(prescription).length, 0)
}

function wrapByChars(text: string, maxChars = PRINT_CONTENT_MAX_CHARS): string[] {
  const result: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    const chars = Array.from(paragraph)
    if (chars.length === 0) {
      result.push('')
      continue
    }
    for (let index = 0; index < chars.length; index += maxChars) {
      result.push(chars.slice(index, index + maxChars).join(''))
    }
  }
  return result
}
