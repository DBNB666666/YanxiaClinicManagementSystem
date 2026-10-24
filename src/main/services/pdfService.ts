import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PrescriptionDetail } from '../../shared/types/models'
import { AppError } from '../../shared/result'
import {
  PRINT_CONTENT_LAYOUT,
  PRINT_PAGE_HEIGHT_MM,
  PRINT_PAGE_WIDTH_MM,
  buildPrescriptionFooterFields,
  buildPrescriptionHeaderFields,
  buildPrescriptionSignatureField,
  getPrescriptionPages,
  type PrintField
} from '../../shared/prescriptionPrintLayout'

const MM = 2.834645669
const PAGE_WIDTH = PRINT_PAGE_WIDTH_MM * MM
const PAGE_HEIGHT = PRINT_PAGE_HEIGHT_MM * MM

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

function findTemplateImage(): string {
  const candidates = [
    process.resourcesPath
      ? path.join(process.resourcesPath, 'prescription-template.jpg')
      : '',
    path.resolve(process.cwd(), 'src/renderer/src/assets/prescription-template.jpg'),
    path.resolve(process.cwd(), 'IMG_9411.JPG')
  ].filter(Boolean)
  const found = candidates.find((file) => fs.existsSync(file))
  if (!found) {
    throw new AppError('PRINT_FAILED', '未找到处方打印模板图片')
  }
  return found
}

class PrintRenderer {
  constructor(
    private readonly page: PDFPage,
    private readonly font: PDFFont,
    private readonly template: PDFImage
  ) {}

  drawBackground(): void {
    this.page.drawImage(this.template, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT
    })
  }

  drawFields(fields: PrintField[]): void {
    for (const field of fields) {
      if (!field.text) continue
      const size = field.size
      const width = field.width * PAGE_WIDTH
      let x = field.x * PAGE_WIDTH
      const textWidth = this.font.widthOfTextAtSize(field.text, size)
      if (field.align === 'right') x += width - textWidth
      if (field.align === 'center') x += (width - textWidth) / 2
      this.page.drawText(field.text, {
        x,
        y: PAGE_HEIGHT * (1 - field.y) - size,
        size,
        font: this.font,
        color: rgb(0.08, 0.08, 0.08)
      })
    }
  }

  drawContent(lines: string[]): void {
    const { x, y, lineHeight, fontSize } = PRINT_CONTENT_LAYOUT
    lines.forEach((line, index) => {
      if (!line) return
      this.page.drawText(line, {
        x: x * PAGE_WIDTH,
        y: PAGE_HEIGHT * (1 - (y + index * lineHeight)) - fontSize,
        size: fontSize,
        font: this.font,
        color: rgb(0.08, 0.08, 0.08)
      })
    })
  }

}

export interface PdfResult {
  path: string
  pageCount: number
}

export interface PrescriptionPdfOptions {
  signatureImage?: string
}

async function embedSignature(
  doc: PDFDocument,
  dataUrl: string | undefined
): Promise<PDFImage | null> {
  if (!dataUrl) return null
  const match = /^data:image\/(png|jpeg);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const bytes = Buffer.from(match[2], 'base64')
  return match[1].toLowerCase() === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)
}

export async function generatePrescriptionPdf(
  prescriptions: PrescriptionDetail[],
  outputPath: string,
  options: PrescriptionPdfOptions = {}
): Promise<PdfResult> {
  if (prescriptions.length === 0) {
    throw new AppError('PRINT_FAILED', '没有可打印的处方')
  }
  const fontPath = findChineseFont()
  const fontBytes = fs.readFileSync(fontPath)
  const templateBytes = fs.readFileSync(findTemplateImage())
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(new Uint8Array(fontBytes), { subset: true })
  const template = await doc.embedJpg(templateBytes)
  const signature = await embedSignature(doc, options.signatureImage)

  for (const prescription of prescriptions) {
    const contentPages = getPrescriptionPages(prescription)
    contentPages.forEach((lines, pageIndex) => {
      const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      const renderer = new PrintRenderer(page, font, template)
      renderer.drawBackground()

      const isLastPage = pageIndex === contentPages.length - 1
      const fields = [
        ...buildPrescriptionHeaderFields(prescription),
        ...buildPrescriptionFooterFields(prescription, isLastPage)
      ]
      const signatureField = isLastPage
        ? buildPrescriptionSignatureField(prescription, lines.length)
        : null
      if (signatureField && !signature) {
        fields.push(signatureField)
      }
      if (signatureField && signature) {
        const maxWidth = signatureField.width * PAGE_WIDTH
        const maxHeight = PAGE_HEIGHT * 0.16
        const scale = Math.min(maxWidth / signature.width, maxHeight / signature.height)
        const width = signature.width * scale
        const height = signature.height * scale
        page.drawImage(signature, {
          x: signatureField.x * PAGE_WIDTH,
          y: PAGE_HEIGHT * (1 - signatureField.y) - height,
          width,
          height
        })
      }
      if (pageIndex > 0) {
        fields.push({
          key: 'continued',
          text: '续页',
          x: 0.79,
          y: 0.052,
          width: 0.1,
          size: 8
        })
      }
      renderer.drawFields(fields)
      renderer.drawContent(lines)
    })
  }

  const totalPages = doc.getPageCount()
  const bytes = await doc.save()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, bytes)
  return { path: outputPath, pageCount: totalPages }
}

export { PAGE_WIDTH, PAGE_HEIGHT, MM }
