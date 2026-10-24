import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generatePrescriptionPdf } from '../../src/main/services/pdfService'
import { buildPrescriptionHtml } from '@shared/printTemplate'
import { createTestContext, P1, P2, P3, seedBase, type TestContext } from '../helpers/testStore'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
  seedBase(ctx.service)
})

afterEach(() => {
  ctx.cleanup()
})

describe('print/pdf', () => {
  it('HTML 模板使用图片并包含患者与金额', () => {
    const created = ctx.service.createPrescription(P1)
    const detail = ctx.service.getPrescription(created.id)
    const html = buildPrescriptionHtml([detail], { templateUrl: 'template.jpg' })
    expect(html).toContain('template.jpg')
    expect(html).toContain('class="template-bg"')
    expect(html).toContain('张秀兰')
    expect(html).toContain('48.00')
    expect(html).toContain('阿莫西林胶囊')
    expect(html).not.toContain('打印时间')
    expect(html).not.toContain('第 1 / 1 页')
  })

  it('生成正32开（130×190mm）单张 PDF 并嵌入模板图片', async () => {
    const created = ctx.service.createPrescription(P1)
    const detail = ctx.service.getPrescription(created.id)
    const out = join(ctx.dir, 'single.pdf')
    const result = await generatePrescriptionPdf([detail], out)
    expect(result.pageCount).toBe(1)
    expect(existsSync(out)).toBe(true)
    const bytes = await import('node:fs').then((fs) => fs.readFileSync(out))
    expect(bytes.length).toBeGreaterThan(200000)
    const doc = await PDFDocument.load(bytes)
    const page = doc.getPages()[0]
    const size = page.getSize()
    expect((size.width * 25.4) / 72).toBeCloseTo(130, 1)
    expect((size.height * 25.4) / 72).toBeCloseTo(190, 1)
  })

  it('批量生成包含多页', async () => {
    const ids = [P1, P2, P3].map((input, index) =>
      ctx.service.createPrescription(input, index === 1).id
    )
    const details = ids.map((id) => ctx.service.getPrescription(id))
    const out = join(ctx.dir, 'batch.pdf')
    const result = await generatePrescriptionPdf(details, out)
    expect(result.pageCount).toBeGreaterThanOrEqual(3)
    const doc = await PDFDocument.load(await import('node:fs').then((fs) => fs.readFileSync(out)))
    expect(doc.getPageCount()).toBe(result.pageCount)
  })
})
