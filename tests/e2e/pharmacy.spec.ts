import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData, waitForToast } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('药房列表、搜索、筛选与视图切换', async ({ page }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await expect(page.getByTestId('drug-card-1')).toBeVisible()
  await expect(page.getByText('阿莫西林胶囊').first()).toBeVisible()
  await expect(page.getByText('详情')).toHaveCount(0)

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

test('点击药品卡片进入详情', async ({ page }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await page.getByTestId('drug-card-1').click()
  await page.waitForSelector('[data-testid="drug-detail-page"]')
  await expect(page.getByTestId('drug-detail-page')).toContainText('阿莫西林胶囊')
})

test('切换板块后编辑药品返回详情而不是药房', async ({ page }) => {
  await openApp(page, '/#/pharmacy/1/edit', '[data-testid="drug-edit-page"]')
  await page.getByRole('link', { name: '处方' }).click()
  await page.waitForSelector('[data-testid="prescription-page"]')
  await page.getByRole('link', { name: '药房' }).click()
  await page.waitForSelector('[data-testid="drug-edit-page"]')
  await page.getByRole('button', { name: '返回药房' }).click()
  await page.waitForSelector('[data-testid="drug-detail-page"]')
})

test('药房新增和编辑用药组合', async ({ page, request }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await page.getByTestId('manage-combos').click()
  await page.getByTestId('new-combo').click()
  await page.getByTestId('combo-name').fill('感冒组合')
  await page.getByTestId('combo-drug-0').selectOption('1')
  await page.getByTestId('combo-qty-0').fill('2')
  await page.getByTestId('save-combo').click()
  await expect(page.getByTestId('combo-1')).toContainText('感冒组合')
  const combos = await apiCall<{ items: { name: string; items: { drugName: string; qty: number }[] }[] }>(
    request,
    'combos',
    'list'
  )
  expect(combos[0].name).toBe('感冒组合')
  expect(combos[0].items[0].drugName).toBe('阿莫西林胶囊')
  expect(combos[0].items[0].qty).toBe(2)

  await page.getByTestId('combo-1').getByText('编辑').click()
  await page.getByTestId('combo-qty-0').fill('3')
  await page.getByTestId('save-combo').click()
  await expect.poll(async () => {
    const updated = await apiCall<{ items: { items: { qty: number }[] }[] }>(
      request,
      'combos',
      'list'
    )
    return updated[0].items[0].qty
  }).toBe(3)
})

test('面包屑显示药品层级并可跳转', async ({ page }) => {
  await openApp(page, '/#/pharmacy/1/edit', '[data-testid="drug-edit-page"]')
  const breadcrumbs = page.getByTestId('breadcrumbs')
  await expect(breadcrumbs).toContainText('药房')
  await expect(breadcrumbs).toContainText('阿莫西林胶囊')
  await expect(breadcrumbs).toContainText('编辑药品')
  await breadcrumbs.getByRole('link', { name: '药房' }).click()
  await page.waitForSelector('[data-testid="pharmacy-page"]')
})

test('新建药品先填细分单位再填库存', async ({ page }) => {
  await openApp(page, '/#/pharmacy/new', '[data-testid="drug-edit-page"]')
  const subunitHeading = page.getByText('细分单位（选填）', { exact: true })
  const stockHeading = page.getByText('库存', { exact: true })
  const subunitBox = await subunitHeading.boundingBox()
  const stockBox = await stockHeading.boundingBox()
  expect(subunitBox).not.toBeNull()
  expect(stockBox).not.toBeNull()
  expect(subunitBox!.y).toBeLessThan(stockBox!.y)
})

test('新增药品、进货与停用', async ({ page, request }) => {
  await openApp(page, '/#/pharmacy', '[data-testid="pharmacy-page"]')
  await page.getByTestId('add-drug').click()
  await page.waitForSelector('[data-testid="drug-edit-page"]')

  await page.getByTestId('drug-name').fill('维生素C片')
  await page.getByTestId('drug-unit').fill('瓶')
  await page.getByTestId('stock-adjust-open').click()
  await page.getByTestId('stock-base').fill('6')
  await page.getByTestId('stock-adjust-save').click()
  await page.getByTestId('drug-warning').fill('5')
  await page.getByTestId('save-drug').click()

  await page.waitForSelector('[data-testid="drug-detail-page"]')
  await expect(page.getByText('维生素C片').first()).toBeVisible()

  await page.getByTestId('purchase-button').click()
  await page.waitForSelector('[data-testid="purchase-dialog"]')
  await page.getByTestId('purchase-qty').fill('2')
  await page.getByTestId('confirm-purchase').click()
  await waitForToast(page, '已进货')

  await expect(page.locator('.stock-number')).toHaveText('8 瓶')
  await expect(page.locator('.stock-unit')).toHaveCount(0)
  const drug = await apiCall<{ stockQty: number; costCents: number }>(request, 'drugs', 'get', [
    5
  ])
  expect(drug.stockQty).toBe(8)
  expect(drug.costCents).toBe(0)

  await page.getByTestId('toggle-drug-status').click()
  await waitForToast(page, '已停用')
  const stopped = await apiCall<{ status: string }>(request, 'drugs', 'get', [5])
  expect(stopped.status).toBe('stopped')
})

test('药品分类和供应商提供历史输入建议', async ({ page }) => {
  await openApp(page, '/#/pharmacy/new', '[data-testid="drug-edit-page"]')
  const categories = await page.locator('#category-options option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value)
  )
  const suppliers = await page.locator('#supplier-options option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value)
  )
  expect(categories).toContain('抗生素')
  expect(suppliers).toContain('华康医药')
})

test('药品保质期提醒与确认处理', async ({ page, request }) => {
  const now = new Date()
  await openApp(page, '/#/pharmacy/new', '[data-testid="drug-edit-page"]')
  await page.getByTestId('drug-name').fill('临期测试药')
  await page.getByTestId('drug-unit').fill('盒')
  await page.getByTestId('stock-adjust-open').click()
  await page.getByTestId('stock-base').fill('5')
  await page.getByTestId('stock-adjust-save').click()
  await page.getByTestId('drug-warning').fill('1')
  await page.getByTestId('drug-production-year').fill(String(now.getFullYear()))
  await page.getByTestId('drug-production-month').fill(String(now.getMonth() + 1))
  await page.getByTestId('drug-production-day').fill('')
  await page.getByTestId('drug-shelf-years').fill('0')
  await page.getByTestId('drug-shelf-months').fill('0')
  await page.getByTestId('drug-shelf-days').fill('20')
  await page.getByTestId('save-drug').click()
  await page.waitForSelector('[data-testid="drug-detail-page"]')
  await expect(page.getByTestId('expiry-banner')).toBeVisible()

  const notifications = await apiCall<{ items: { drugName: string; reason: string }[] }>(
    request,
    'notifications',
    'list'
  )
  expect(notifications.items.some((item) => item.drugName === '临期测试药' && item.reason === 'expiry')).toBe(true)

  await page.getByTestId('confirm-expiry').click()
  await page.waitForTimeout(200)
  await expect(page.getByTestId('expiry-banner')).toHaveCount(0)
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
