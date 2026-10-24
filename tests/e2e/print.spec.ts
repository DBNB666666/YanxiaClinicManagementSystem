import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('批量导出合并且每张从新页开始', async ({ request }) => {
  const second = await apiCall<{ id: number }>(request, 'prescriptions', 'create', [
    {
      patientName: '批量患者',
      gender: '男',
      age: '35',
      diagnosis: '测试',
      issueDate: '2026-10-22',
      rp: '批量导出测试。',
      doctor: '王医生',
      items: [{ drugId: 1, qty: 1, usage: '口服', frequency: '每日1次' }],
      injectionFeeCents: 0
    },
    false
  ])
  const result = await apiCall<{ path: string; pageCount: number }>(request, 'print', 'exportPdf', [
    [1, second.id]
  ])
  expect(result.pageCount).toBeGreaterThanOrEqual(2)
  const doc = await PDFDocument.load(readFileSync(result.path))
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
})

test('图片模板打印预览与正32开 PDF 导出', async ({ page, request }) => {
  await openApp(page, '/#/prescriptions/print?ids=1', '[data-testid="print-page"]')
  const frame = page.frameLocator('.print-frame')
  await expect(frame.getByText('张秀兰').first()).toBeVisible()
  await expect(frame.getByText('48.00').first()).toBeVisible()
  await expect(frame.getByText('打印时间')).toHaveCount(0)
  await expect(frame.getByText('第 1 / 1 页')).toHaveCount(0)
  await expect(frame.getByText('用法：口服').first()).toBeVisible()
  await expect(frame.getByText('王医生').first()).toBeVisible()
  const image = frame.locator('img.template-bg')
  await expect(image).toHaveCount(1)
  await expect
    .poll(async () => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0)

  await page.getByRole('button', { name: '导出 PDF' }).click()
  await expect(page.locator('.toast')).toContainText('已生成 PDF')

  const result = await apiCall<{ path: string; pageCount: number }>(request, 'print', 'exportPdf', [
    [1]
  ])
  expect(result.pageCount).toBe(1)
  const doc = await PDFDocument.load(readFileSync(result.path))
  expect(doc.getPageCount()).toBe(1)
  const pageSize = doc.getPages()[0].getSize()
  expect((pageSize.width * 25.4) / 72).toBeCloseTo(130, 1)
  expect((pageSize.height * 25.4) / 72).toBeCloseTo(190, 1)
})
