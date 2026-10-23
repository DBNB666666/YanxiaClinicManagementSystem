import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData, waitForToast } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('药房列表、搜索、筛选与视图切换', async ({ page }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await expect(page.getByTestId('drug-card-1')).toBeVisible()
  await expect(page.getByText('阿莫西林胶囊').first()).toBeVisible()

  await page.getByTestId('drug-search').fill('阿莫')
  await expect(page.getByTestId('drug-card-1')).toBeVisible()
  await expect(page.getByText('布洛芬缓释胶囊')).toHaveCount(0)
  await page.getByTestId('drug-search').fill('')

  await page.getByTestId('view-list').click()
  await expect(page.getByTestId('drug-row-1')).toBeVisible()
  await expect(page.getByTestId('drug-row-2')).toBeVisible()

  await page.getByTestId('drug-filter').selectOption('low')
  await expect(page.getByTestId('drug-row-2')).toBeVisible()
  await expect(page.getByText('阿莫西林胶囊')).toHaveCount(0)
})

test('新增药品、进货与停用', async ({ page, request }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await page.getByTestId('add-drug').click()
  await page.waitForSelector('[data-testid="drug-edit-page"]')

  await page.getByTestId('drug-name').fill('维生素C片')
  await page.getByTestId('drug-unit').fill('瓶')
  await page.getByTestId('drug-stock').fill('6')
  await page.getByTestId('drug-warning').fill('5')
  await page.getByTestId('drug-cost').fill('3.00')
  await page.getByTestId('drug-price').fill('6.00')
  await page.getByTestId('save-drug').click()

  await page.waitForSelector('[data-testid="drug-detail-page"]')
  await expect(page.getByText('维生素C片').first()).toBeVisible()

  await page.getByTestId('purchase-button').click()
  await page.waitForSelector('[data-testid="purchase-dialog"]')
  await page.getByTestId('purchase-qty').fill('2')
  await page.getByTestId('purchase-cost').fill('3.50')
  await page.getByTestId('confirm-purchase').click()
  await waitForToast(page, '已进货')

  await expect(page.locator('.stock-number')).toHaveText('8')
  const drug = await apiCall<{ stockQty: number; costCents: number }>(request, 'drugs', 'get', [
    5
  ])
  expect(drug.stockQty).toBe(8)
  expect(drug.costCents).toBe(350)

  await page.getByTestId('toggle-drug-status').click()
  await waitForToast(page, '已停用')
  const stopped = await apiCall<{ status: string }>(request, 'drugs', 'get', [5])
  expect(stopped.status).toBe('stopped')
})

test('已用药品删除时自动转为停用', async ({ page, request }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await page.getByTestId('drug-card-1').getByText('删除').click()
  await page.getByTestId('delete-drug-dialog-confirm').click()
  await page.waitForSelector('[data-testid="stop-drug-dialog"]')
  await page.getByTestId('stop-drug-dialog-confirm').click()
  await waitForToast(page, '已停用')
  const drug = await apiCall<{ status: string }>(request, 'drugs', 'get', [1])
  expect(drug.status).toBe('stopped')
})
