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
  const signature = page.frameLocator('.print-frame').locator('img.signature-image')
  await expect(signature).toHaveCount(1)
  await expect
    .poll(async () => signature.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0)
})
