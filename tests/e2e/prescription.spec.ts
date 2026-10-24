import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('处方列表、搜索与视图切换', async ({ page }) => {
  await openApp(page)
  await expect(page.getByTestId('rx-card-1')).toBeVisible()
  await page.getByTestId('prescription-search').fill('张秀兰')
  await expect(page.getByTestId('rx-card-1')).toBeVisible()
  await page.getByTestId('prescription-search').fill('李国强')
  await expect(page.getByText('没有找到匹配的处方')).toBeVisible()
  await page.getByTestId('prescription-search').fill('')

  await page.getByTestId('view-list').click()
  await expect(page.getByTestId('rx-row-1')).toBeVisible()
  await expect(page.getByRole('cell', { name: '张秀兰', exact: true })).toBeVisible()
})

test('点击处方卡片进入详情页', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('rx-card-1').click()
  await page.waitForSelector('[data-testid="prescription-detail-page"]')
  await expect(page.getByTestId('detail-patient-name')).toHaveText('张秀兰')
  await expect(page.getByTestId('detail-rp')).toContainText('注意休息，低盐饮食。')
  await expect(page.getByTestId('detail-medication-1')).toContainText('阿莫西林胶囊')
  await expect(page.getByTestId('detail-total')).toHaveText('¥68.00')
  await expect(page.getByTestId('detail-edit')).toBeVisible()
  await expect(page.getByTestId('detail-print')).toBeVisible()
  await expect(page.getByTestId('detail-delete')).toBeVisible()
})

test('点击处方列表行进入详情页', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('view-list').click()
  await page.getByTestId('rx-row-1').click()
  await page.waitForSelector('[data-testid="prescription-detail-page"]')
  await expect(page.getByTestId('detail-patient-name')).toHaveText('张秀兰')
})

test('详情页提供编辑、打印与删除操作', async ({ page, request }) => {
  await openApp(page, '/#/prescriptions/1', '[data-testid="prescription-detail-page"]')

  await page.getByTestId('detail-edit').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')

  await openApp(page, '/#/prescriptions/1', '[data-testid="prescription-detail-page"]')
  await page.getByTestId('detail-print').click()
  await page.waitForSelector('[data-testid="print-page"]')

  await openApp(page, '/#/prescriptions/1', '[data-testid="prescription-detail-page"]')
  await page.getByTestId('detail-delete').click()
  await page.getByTestId('delete-prescription-detail-dialog-confirm').click()
  await page.waitForSelector('[data-testid="prescription-page"]')
  const list = await apiCall<{ total: number }>(request, 'prescriptions', 'list', [
    { page: 1, pageSize: 20 }
  ])
  expect(list.total).toBe(0)
})

test('编辑处方数量按差额扣库存', async ({ page, request }) => {
  await openApp(page)
  await page.getByTestId('rx-card-1').getByText('编辑').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')
  await page.getByTestId('med-qty-1').fill('3')
  await page.getByTestId('save-prescription').click()
  await page.waitForSelector('[data-testid="prescription-page"]')

  const detail = await apiCall<{
    drugAmountCents: number
    costCents: number
    totalCents: number
  }>(request, 'prescriptions', 'get', [1])
  expect(detail.drugAmountCents).toBe(6600)
  expect(detail.costCents).toBe(2900)
  expect(detail.totalCents).toBe(8600)
  const drug = await apiCall<{ stockQty: number }>(request, 'drugs', 'get', [1])
  expect(drug.stockQty).toBe(7)
})

test('新建处方并从药房添加用药', async ({ page, request }) => {
  await openApp(page)
  await page.getByTestId('add-prescription').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')

  await page.getByTestId('rx-patient-name').fill('测试患者')
  await page.getByTestId('rx-gender-女').click()
  await page.getByTestId('rx-age').fill('30')
  await page.getByTestId('rx-diagnosis').fill('上呼吸道感染')
  await page.getByTestId('rx-doctor').fill('李医生')
  await page.getByTestId('rx-rp').fill('多喝水，注意休息。')

  await page.getByTestId('add-medication').click()
  await page.getByTestId('drug-picker-search').fill('阿莫')
  await page.getByTestId('drug-option-1').click()
  await page.getByTestId('confirm-add-medications').click()
  await expect(page.getByTestId('medication-table')).toBeVisible()
  await page.getByTestId('med-usage-1').fill('口服')
  await page.getByTestId('med-frequency-1').fill('每日3次')
  await page.getByTestId('save-prescription').click()

  await page.waitForSelector('[data-testid="prescription-page"]')
  const list = await apiCall<{ total: number }>(request, 'prescriptions', 'list', [
    { page: 1, pageSize: 20 }
  ])
  expect(list.total).toBe(2)
  const drug = await apiCall<{ stockQty: number }>(request, 'drugs', 'get', [1])
  expect(drug.stockQty).toBe(7)
})

test('库存不足时确认后以负库存保存', async ({ page, request }) => {
  await openApp(page)
  await page.getByTestId('add-prescription').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('负库存患者')
  await page.getByTestId('rx-gender-男').click()
  await page.getByTestId('rx-age').fill('40')
  await page.getByTestId('rx-diagnosis').fill('脱水')
  await page.getByTestId('rx-doctor').fill('王医生')
  await page.getByTestId('rx-rp').fill('补液。')

  await page.getByTestId('add-medication').click()
  await page.getByTestId('drug-picker-search').fill('生理盐水')
  await page.getByTestId('drug-option-3').click()
  await page.getByTestId('confirm-add-medications').click()
  await page.getByTestId('save-prescription').click()

  await page.waitForSelector('[data-testid="stock-confirm-dialog"]')
  await page.getByTestId('stock-confirm-dialog-confirm').click()
  await page.waitForSelector('[data-testid="prescription-page"]')
  const drug = await apiCall<{ stockQty: number }>(request, 'drugs', 'get', [3])
  expect(drug.stockQty).toBe(-1)
})

test('删除处方退回库存', async ({ page, request }) => {
  await openApp(page)
  await page.getByTestId('rx-delete-1').click()
  await page.getByTestId('delete-prescription-dialog-confirm').click()
  await expect(page.getByTestId('rx-card-1')).toHaveCount(0)
  const list = await apiCall<{ total: number }>(request, 'prescriptions', 'list', [
    { page: 1, pageSize: 20 }
  ])
  expect(list.total).toBe(0)
  const drug = await apiCall<{ stockQty: number }>(request, 'drugs', 'get', [1])
  expect(drug.stockQty).toBe(10)
})

test('打印预览展示处方内容', async ({ page }) => {
  await openApp(page, '/#/prescriptions/print?ids=1', '[data-testid="print-page"]')
  await expect(page.locator('.print-frame')).toBeVisible()
  const frame = page.frameLocator('.print-frame')
  await expect(frame.getByText('张秀兰').first()).toBeVisible()
  await expect(frame.getByText('燕霞诊所').first()).toBeVisible()
  await expect(frame.getByText('48.00').first()).toBeVisible()
})
