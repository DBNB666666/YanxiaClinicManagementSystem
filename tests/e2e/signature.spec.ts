import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZkAAAAASUVORK5CYII='

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('上传签名图、保存到用户数据并在打印预览中使用', async ({ page, request }) => {
  await openApp(page, '/#/prescriptions/1/edit', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('signature-upload').setInputFiles({
    name: 'signature.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_1X1, 'base64')
  })
  await expect(page.getByText('签名图已保存到本机数据')).toBeVisible()
  await expect(page.getByTestId('signature-preview')).toBeVisible()

  const settings = await apiCall<{ signatureImage: string }>(request, 'settings', 'get')
  expect(settings.signatureImage.startsWith('data:image/png;base64,')).toBe(true)

  await openApp(page, '/#/prescriptions/1/edit', '[data-testid="prescription-edit-page"]')
  await expect(page.getByTestId('signature-preview')).toBeVisible()

  await openApp(page, '/#/prescriptions/print?ids=1', '[data-testid="print-page"]')
  const signature = page.getByTestId('signature-drag')
  await expect(signature).toBeVisible()
  await expect
    .poll(async () => signature.locator('img').evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0)

  await signature.scrollIntoViewIfNeeded()
  const box = await signature.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.max(1, box!.height / 2))
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 40, box!.y + Math.max(1, box!.height / 2) + 20)
  await page.mouse.up()
  await expect
    .poll(async () => (await apiCall<{ signatureX: number }>(request, 'settings', 'get')).signatureX)
    .toBeGreaterThan(0.675)

  const handle = page.getByTestId('signature-resize')
  await handle.scrollIntoViewIfNeeded()
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()
  await page.mouse.move(handleBox!.x + 4, handleBox!.y + 4)
  await page.mouse.down()
  await page.mouse.move(handleBox!.x + 34, handleBox!.y + 4)
  await page.mouse.up()
  await expect
    .poll(async () => (await apiCall<{ signatureWidth: number }>(request, 'settings', 'get')).signatureWidth)
    .toBeGreaterThan(0.28)
})
