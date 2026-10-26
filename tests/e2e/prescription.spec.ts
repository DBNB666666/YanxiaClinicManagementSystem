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
  await expect(page.getByText('Rp 处方正文')).toHaveCount(0)
  await expect(page.getByTestId('detail-medication-1')).toContainText('阿莫西林胶囊')
  await expect(page.getByTestId('detail-total')).toHaveText('¥68.00')
  await expect(page.getByTestId('detail-edit')).toBeVisible()
  await expect(page.getByTestId('detail-print')).toBeVisible()
  await expect(page.getByTestId('detail-delete')).toBeVisible()
})

test('面包屑显示处方层级并可跳转', async ({ page }) => {
  await openApp(page, '/#/prescriptions/1/edit', '[data-testid="prescription-edit-page"]')
  const breadcrumbs = page.getByTestId('breadcrumbs')
  await expect(breadcrumbs).toContainText('处方')
  await expect(breadcrumbs).toContainText('张秀兰')
  await expect(breadcrumbs).toContainText('编辑处方')
  await breadcrumbs.getByRole('link', { name: '张秀兰' }).click()
  await page.waitForSelector('[data-testid="prescription-detail-page"]')
  await page.getByTestId('breadcrumbs').getByRole('link', { name: '处方' }).click()
  await page.waitForSelector('[data-testid="prescription-page"]')
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

test('切换板块后回到原编辑页且未保存内容不丢', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('rx-card-1').getByText('编辑').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('草稿患者')
  await page.waitForTimeout(150)

  await page.getByRole('link', { name: '药房' }).click()
  await page.waitForSelector('[data-testid="pharmacy-page"]')
  await page.getByRole('link', { name: '处方' }).click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')
  await expect(page.getByTestId('rx-patient-name')).toHaveValue('草稿患者')
  await page.getByRole('button', { name: '返回处方' }).click()
  await page.getByTestId('leave-confirm-dialog').getByRole('button', { name: '离开' }).click()
  await page.waitForSelector('[data-testid="prescription-detail-page"]')
})

test('新建处方离开后再次新增是空白表单', async ({ page }) => {
  await openApp(page, '/#/prescriptions/new', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('未保存患者')
  await page.getByRole('button', { name: '返回处方' }).click()
  await page.getByTestId('leave-confirm-dialog').getByRole('button', { name: '离开' }).click()
  await page.waitForSelector('[data-testid="prescription-page"]')
  await page.getByTestId('add-prescription').click()
  await page.waitForSelector('[data-testid="prescription-edit-page"]')
  await expect(page.getByTestId('rx-patient-name')).toHaveValue('')
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
  expect(detail.feeCents).toBe(6800)
  expect(detail.totalCents).toBe(6800)
  const drug = await apiCall<{ stockQty: number }>(request, 'drugs', 'get', [1])
  expect(drug.stockQty).toBe(7)
})

test('开方手动选批次，超量自动跨批次补扣', async ({ page, request }) => {
  const created = await apiCall<{ id: number }>(request, 'drugs', 'create', [
    {
      name: '跨批测试药',
      unit: '盒',
      inboundDate: '2026-10-01',
      stockQty: 8,
      warningQty: 1,
      category: '',
      supplier: '',
      indications: '',
      costCents: 0,
      priceCents: 0,
      batches: [
        { productionDate: '2026-01', shelfLifeYears: 1, qty: 5 },
        { productionDate: '2026-02', shelfLifeYears: 1, qty: 3 }
      ]
    }
  ])
  const drug = await apiCall<{ batches: { id: number; expiryDate: string; qtyUnits: number }[] }>(
    request,
    'drugs',
    'get',
    [created.id]
  )
  const selected = drug.batches.find((batch) => batch.qtyUnits === 3)!
  const other = drug.batches.find((batch) => batch.id !== selected.id)!

  await openApp(page, '/#/prescriptions/new', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('跨批患者')
  await page.getByTestId('rx-age').fill('40')
  await page.getByTestId('rx-diagnosis').fill('测试')
  await page.getByTestId('rx-doctor').fill('王医生')
  await page.getByTestId('add-medication').click()
  await page.getByTestId('drug-picker-search').fill('跨批测试药')
  await page.getByTestId(`drug-option-${created.id}`).click()
  await page.getByTestId('confirm-add-medications').click()
  await page.getByTestId(`med-batch-${created.id}`).selectOption(String(selected.id))
  await page.getByTestId(`med-qty-${created.id}`).fill('4')
  await page.getByTestId('save-prescription').click()
  await page.waitForSelector('[data-testid="prescription-page"]')

  const after = await apiCall<{ batches: { id: number; qtyUnits: number }[] }>(request, 'drugs', 'get', [
    created.id
  ])
  const selectedAfter = after.batches.find((batch) => batch.id === selected.id)!
  const otherAfter = after.batches.find((batch) => batch.id === other.id)!
  expect(selectedAfter.qtyUnits).toBe(0)
  expect(otherAfter.qtyUnits).toBe(4)
})

test('常用药可在开方时快速加入', async ({ page, request }) => {
  await apiCall(request, 'drugs', 'setCommon', [{ id: 1, isCommon: true }])
  await openApp(page, '/#/prescriptions/new', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('add-medication').click()
  await expect(page.getByTestId('common-drugs')).toBeVisible()
  await page.getByTestId('common-drug-1').click()
  await expect(page.getByTestId('medication-table')).toBeVisible()
  await expect(page.getByTestId('med-unit-label-1')).toHaveText('盒')
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
  await page.getByTestId('rx-fee').fill('25.00')
  await expect(page.getByTestId('rx-rp')).toHaveCount(0)

  await page.getByTestId('add-medication').click()
  await page.getByTestId('drug-picker-search').fill('阿莫')
  await page.getByTestId('drug-option-1').click()
  await page.getByTestId('confirm-add-medications').click()
  await expect(page.getByTestId('medication-table')).toBeVisible()
  await expect(page.getByTestId('med-unit-label-1')).toHaveText('盒')
  await page.getByTestId('med-usage-1').fill('口服，每日3次')
  await expect(page.getByTestId('med-frequency-1')).toHaveCount(0)
  await page.getByTestId('save-prescription').click()

  await page.waitForSelector('[data-testid="prescription-page"]')
  const list = await apiCall<{ total: number; items: { patientName: string; feeCents: number }[] }>(
    request,
    'prescriptions',
    'list',
    [{ page: 1, pageSize: 20 }]
  )
  expect(list.total).toBe(2)
  expect(list.items.find((item) => item.patientName === '测试患者')?.feeCents).toBe(2500)
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
  await expect(frame.getByText('68.00').first()).toBeVisible()
  await expect(frame.getByText('打印时间')).toHaveCount(0)
  await expect(frame.getByText('嘱托')).toHaveCount(0)
})
