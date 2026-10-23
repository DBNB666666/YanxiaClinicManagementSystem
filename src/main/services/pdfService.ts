import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PrescriptionDetail } from '../../shared/types/models'
import { AppError } from '../../shared/result'
import { formatCents } from '../../shared/money'
import { formatDateTime } from '../../shared/date'

const MM = 2.834645669
const PAGE_WIDTH = 148 * MM
const PAGE_HEIGHT = 210 * MM
const MARGIN = {
  top: 12 * MM,
  bottom: 14 * MM,
  left: 14 * MM,
  right: 14 * MM
}
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right

function findChineseFont(): string {
  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const candidates = [
    path.join(windir, 'Fonts', 'simhei.ttf'),
    path.join(windir, 'Fonts', 'simkai.ttf'),
    path.join(windir, 'Fonts', 'msyh.ttf')
  ]
  const found = candidates.find((file) => fs.existsSync(file))
  if (!found) {
    throw new AppError('PRINT_FAILED', '未找到中文字体（simhei.ttf），无法生成 PDF')
  }
  return found
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine) {
      lines.push('')
      continue
    }
    let current = ''
    for (const char of Array.from(rawLine)) {
      const next = current + char
      if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(current)
        current = char
      } else {
        current = next
      }
    }
    lines.push(current)
  }
  return lines
}

class PrescriptionPdf {
  private page!: PDFPage
  private y = 0
  private pageIndex = 0

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly prescription: PrescriptionDetail
  ) {}

  get currentPage(): PDFPage {
    return this.page
  }

  get currentPageIndex(): number {
    return this.pageIndex
  }

  start(): void {
    this.newPage(false)
    this.drawHeader()
    this.drawPatient()
    this.drawDiagnosis()
    this.drawRp()
    this.drawMedications()
    this.drawFees()
    this.drawSignature()
  }

  private newPage(continuation: boolean): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.pageIndex = this.doc.getPageCount() - 1
    this.y = PAGE_HEIGHT - MARGIN.top
    if (continuation) {
      this.page.drawText('燕霞诊所（续）', {
        x: MARGIN.left,
        y: this.y,
        size: 12,
        font: this.font
      })
      this.y -= 16
      this.page.drawText(
        `姓名：${this.prescription.patientName}    日期：${this.prescription.issueDate}`,
        { x: MARGIN.left, y: this.y, size: 9, font: this.font, color: rgb(0.25, 0.25, 0.25) }
      )
      this.y -= 14
      this.line()
    }
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < MARGIN.bottom) {
      this.newPage(true)
    }
  }

  private line(): void {
    this.page.drawLine({
      start: { x: MARGIN.left, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
      thickness: 0.6,
      color: rgb(0, 0, 0)
    })
  }

  private drawHeader(): void {
    const title = '燕霞诊所'
    const titleSize = 18
    const width = this.font.widthOfTextAtSize(title, titleSize)
    this.page.drawText(title, {
      x: (PAGE_WIDTH - width) / 2,
      y: this.y - 18,
      size: titleSize,
      font: this.font
    })
    this.y -= 28
    this.line()
    this.y -= 6
  }

  private drawPatient(): void {
    const text = `姓名：${this.prescription.patientName}    性别：${this.prescription.gender}    年龄：${this.prescription.age}`
    this.page.drawText(text, { x: MARGIN.left, y: this.y - 12, size: 10.5, font: this.font })
    this.y -= 18
    const second = `日期：${this.prescription.issueDate}    医师：${this.prescription.doctor}`
    this.page.drawText(second, { x: MARGIN.left, y: this.y - 12, size: 10.5, font: this.font })
    this.y -= 18
  }

  private drawDiagnosis(): void {
    this.y -= 4
    this.paragraph(`诊断：${this.prescription.diagnosis}`, 10.5, 16)
    this.y -= 2
  }

  private drawRp(): void {
    this.paragraph('Rp', 12, 20)
    this.paragraph(this.prescription.rp, 11, 17.5)
    this.y -= 4
  }

  private drawMedications(): void {
    const colWidths = [CONTENT_WIDTH * 0.46, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.12]
    const header = ['药品', '数量', '用法用量', '金额']
    const fontSize = 9.5
    const lineHeight = 13

    const drawHeader = (): void => {
      this.ensureSpace(30)
      let x = MARGIN.left
      header.forEach((cell, index) => {
        const alignRight = index === 1 || index === 3
        this.page.drawText(cell, {
          x: alignRight ? x + colWidths[index] - this.font.widthOfTextAtSize(cell, fontSize) - 2 : x,
          y: this.y - fontSize,
          size: fontSize,
          font: this.font
        })
        x += colWidths[index]
      })
      this.y -= fontSize + 4
      this.line()
      this.y -= 4
    }

    drawHeader()

    for (const item of this.prescription.items) {
      const drugLines = wrapText(item.drugName, this.font, fontSize, colWidths[0] - 4)
      const usageText = [item.usage, item.frequency].filter(Boolean).join('　')
      const usageLines = wrapText(usageText, this.font, fontSize, colWidths[2] - 4)
      const qtyText = `${item.qty} ${item.unit}`
      const amountText = formatCents(item.amountCents)
      const maxLines = Math.max(drugLines.length, usageLines.length, 1)
      const rowHeight = maxLines * lineHeight + 6
      if (this.y - rowHeight < MARGIN.bottom) {
        this.newPage(true)
        drawHeader()
      }

      const cells = [
        { x: MARGIN.left, lines: drugLines },
        {
          x: MARGIN.left + colWidths[0],
          lines: [qtyText],
          right: true,
          width: colWidths[1]
        },
        { x: MARGIN.left + colWidths[0] + colWidths[1], lines: usageLines },
        {
          x: MARGIN.left + colWidths[0] + colWidths[1] + colWidths[2],
          lines: [amountText],
          right: true,
          width: colWidths[3]
        }
      ]

      cells.forEach((cell) => {
        cell.lines.forEach((line, index) => {
          const textWidth = this.font.widthOfTextAtSize(line, fontSize)
          const x = cell.right && 'width' in cell ? cell.x + (cell.width ?? 0) - textWidth - 2 : cell.x
          this.page.drawText(line, {
            x,
            y: this.y - fontSize - index * lineHeight,
            size: fontSize,
            font: this.font
          })
        })
      })
      this.y -= rowHeight
      this.page.drawLine({
        start: { x: MARGIN.left, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
        thickness: 0.4,
        color: rgb(0.65, 0.65, 0.65)
      })
      this.y -= 3
    }
  }

  private drawFees(): void {
    this.ensureSpace(80)
    this.page.drawLine({
      start: { x: MARGIN.left, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
      thickness: 0.4,
      color: rgb(0.65, 0.65, 0.65)
    })
    this.y -= 6
    const rows: [string, number][] = [
      ['药品金额', this.prescription.drugAmountCents],
      ['注射费', this.prescription.injectionFeeCents],
      ['合计', this.prescription.totalCents]
    ]
    for (const [label, value] of rows) {
      const valueText = formatCents(value)
      this.page.drawText(label, { x: MARGIN.left, y: this.y - 10, size: 10.5, font: this.font })
      this.page.drawText(valueText, {
        x: PAGE_WIDTH - MARGIN.right - this.font.widthOfTextAtSize(valueText, 10.5),
        y: this.y - 10,
        size: 10.5,
        font: this.font
      })
      this.y -= 16
    }
  }

  private drawSignature(): void {
    this.ensureSpace(40)
    this.y -= 22
    this.page.drawLine({
      start: { x: PAGE_WIDTH - MARGIN.right - 90, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
      thickness: 0.5,
      color: rgb(0, 0, 0)
    })
    this.page.drawText('医师签名', {
      x: PAGE_WIDTH - MARGIN.right - 90,
      y: this.y + 4,
      size: 8.5,
      font: this.font,
      color: rgb(0.3, 0.3, 0.3)
    })
  }

  private paragraph(text: string, size: number, lineHeight: number): void {
    const lines = wrapText(text, this.font, size, CONTENT_WIDTH)
    for (const line of lines) {
      this.ensureSpace(lineHeight)
      this.page.drawText(line, {
        x: MARGIN.left,
        y: this.y - size,
        size,
        font: this.font
      })
      this.y -= lineHeight
    }
  }

  drawPageFooters(totalPages: number): void {
    const page = this.page
    const footer = `打印时间：${formatDateTime(new Date().toISOString())}`
    page.drawText(footer, {
      x: MARGIN.left,
      y: 18,
      size: 8,
      font: this.font,
      color: rgb(0.35, 0.35, 0.35)
    })
    const pageText = `第 ${this.pageIndex + 1} / ${totalPages} 页`
    page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN.right - this.font.widthOfTextAtSize(pageText, 8),
      y: 18,
      size: 8,
      font: this.font,
      color: rgb(0.35, 0.35, 0.35)
    })
  }
}

export interface PdfResult {
  path: string
  pageCount: number
}

export async function generatePrescriptionPdf(
  prescriptions: PrescriptionDetail[],
  outputPath: string
): Promise<PdfResult> {
  if (prescriptions.length === 0) {
    throw new AppError('PRINT_FAILED', '没有可打印的处方')
  }
  const fontPath = findChineseFont()
  const fontBytes = fs.readFileSync(fontPath)
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(new Uint8Array(fontBytes), { subset: true })

  for (const prescription of prescriptions) {
    const writer = new PrescriptionPdf(doc, font, prescription)
    writer.start()
  }

  const totalPages = doc.getPageCount()
  // 每个 writer 只知道自己最后一页；重新遍历所有页面统一写页脚。
  for (let index = 0; index < totalPages; index += 1) {
    const page = doc.getPage(index)
    page.drawText(`打印时间：${formatDateTime(new Date().toISOString())}`, {
      x: MARGIN.left,
      y: 18,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35)
    })
    const pageText = `第 ${index + 1} / ${totalPages} 页`
    page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN.right - font.widthOfTextAtSize(pageText, 8),
      y: 18,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35)
    })
  }

  const bytes = await doc.save()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, bytes)
  return { path: outputPath, pageCount: totalPages }
}

export { PAGE_WIDTH, PAGE_HEIGHT, MM }
