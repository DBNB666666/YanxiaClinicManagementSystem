import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('药品细分单位与按支开方', async ({ page, request }) => {
  await openApp(page, '/#/pharmacy/new', '[data-testid="drug-edit-page"]')
  await page.getByTestId('drug-name').fill('注射用阿莫西林')
  await page.getByTestId('drug-unit').fill('盒')
  await page.getByTestId('stock-adjust-open').click()
  await page.getByTestId('stock-base').fill('5')
  await page.getByTestId('stock-adjust-save').click()
  await page.getByTestId('drug-warning').fill('2')
  await page.getByTestId('drug-cost').fill('10')
  await page.getByTestId('drug-price').fill('50')
  await page.getByTestId('add-drug-subunit').click()
  await page.getByTestId('drug-subunit-unit-0').fill('支')
  await page.getByTestId('drug-subunit-factor-0').fill('7')
  await page.getByTestId('drug-subunit-price-0').fill('8')
  await page.getByTestId('drug-subunit-cost-0').fill('2')
  await page.getByTestId('save-drug').click()
  await page.waitForSelector('[data-testid="drug-detail-page"]')

  const list = await apiCall<{ items: { id: number; name: string }[] }>(
    request,
    'drugs',
    'list',
    [{ query: '注射用阿莫西林', page: 1, pageSize: 20 }]
  )
  const drug = list.items.find((item) => item.name === '注射用阿莫西林')
  expect(drug).toBeDefined()

  await openApp(page, '/#/prescriptions/new', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('张三')
  await page.getByTestId('rx-age').fill('32')
  await page.getByTestId('rx-diagnosis').fill('感染')
  await page.getByTestId('rx-doctor').fill('李医生')
  await page.getByTestId('add-medication').click()
  await page.getByTestId('drug-picker-search').fill('注射用阿莫西林')
  await page.getByTestId(`drug-option-${drug!.id}`).click()
  await page.getByTestId('confirm-add-medications').click()
  await expect(page.getByTestId(`med-unit-${drug!.id}`)).toHaveValue('盒')
  await page.getByTestId(`med-unit-${drug!.id}`).selectOption('支')
  await page.getByTestId(`med-qty-${drug!.id}`).fill('1')
  await page.getByTestId('save-prescription').click()
  await page.waitForSelector('[data-testid="prescription-page"]')

  const updated = await apiCall<{ stockQty: number; stockUnits: number }>(request, 'drugs', 'get', [
    drug!.id
  ])
  expect(updated.stockQty).toBeCloseTo(5 - 1 / 7, 5)
  expect(updated.stockUnits).toBe(34)

  await openApp(page, `/#/pharmacy/${drug!.id}`, '[data-testid="drug-detail-page"]')
  await expect(page.locator('.stock-number')).toContainText('4盒')
  await expect(page.locator('.stock-number')).toContainText('6支')
  await expect(page.locator('.stock-number')).not.toContainText('4.857')

  await openApp(page, `/#/pharmacy/${drug!.id}/edit`, '[data-testid="drug-edit-page"]')
  await expect(page.getByTestId('drug-stock-display')).toHaveText('4盒 6支')
  await page.getByTestId('stock-adjust-open').click()
  await page.getByTestId('stock-base').fill('9')
  await page.getByTestId('stock-loose-0').fill('5')
  await page.getByTestId('stock-adjust-save').click()
  await expect(page.getByTestId('drug-stock-display')).toHaveText('9盒 5支')
  await page.getByTestId('save-drug').click()
  await page.waitForSelector('[data-testid="drug-detail-page"]')
  await expect(page.locator('.stock-number')).toContainText('9盒')
  await expect(page.locator('.stock-number')).toContainText('5支')
})
