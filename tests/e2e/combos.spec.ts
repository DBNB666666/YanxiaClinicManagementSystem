import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('处方可添加药房组合并临时组合，分别填写用法', async ({ page, request }) => {
  const combo = await apiCall<{ id: number }>(request, 'combos', 'create', [
    {
      name: '感冒组合',
      items: [
        { drugId: 1, qty: 2, unit: '盒' },
        { drugId: 2, qty: 1, unit: '盒' }
      ]
    }
  ])

  await openApp(page, '/#/prescriptions/new', '[data-testid="prescription-edit-page"]')
  await page.getByTestId('rx-patient-name').fill('组合患者')
  await page.getByTestId('rx-age').fill('40')
  await page.getByTestId('rx-diagnosis').fill('感冒')
  await page.getByTestId('rx-doctor').fill('李医生')
  await page.getByTestId('rx-fee').fill('30.00')

  await page.getByTestId('saved-combo-select').selectOption(String(combo.id))
  await page.getByTestId('add-saved-combo').click()
  await expect(page.locator('.rx-combo-head').filter({ hasText: '感冒组合' })).toBeVisible()

  await page.getByTestId('add-combo').click()
  await page.getByTestId('drug-option-4').click()
  await page.getByTestId('confirm-add-medications').click()
  await expect(page.locator('.rx-combo-head').filter({ hasText: '临时组合' })).toBeVisible()

  const usageInputs = page.locator('.rx-combo-usage input')
  await usageInputs.nth(0).fill('口服，每天3次')
  await usageInputs.nth(1).fill('外用，每天1次')

  await page.getByTestId('save-prescription').click()
  await page.waitForSelector('[data-testid="prescription-page"]')

  const list = await apiCall<{ items: { id: number; patientName: string }[] }>(
    request,
    'prescriptions',
    'list',
    [{ page: 1, pageSize: 20 }]
  )
  const created = list.items.find((item) => item.patientName === '组合患者')
  expect(created).toBeDefined()
  const detail = await apiCall<{
    feeCents: number
    items: { drugName: string; groupKey: string; groupName: string; groupUsage: string }[]
  }>(request, 'prescriptions', 'get', [created!.id])
  expect(detail.feeCents).toBe(3000)
  expect(detail.items).toHaveLength(3)
  expect(detail.items.filter((item) => item.groupName === '感冒组合')).toHaveLength(2)
  expect(detail.items.filter((item) => item.groupName === '临时组合')).toHaveLength(1)
  expect(detail.items.find((item) => item.groupName === '感冒组合')?.groupUsage).toBe(
    '口服，每天3次'
  )
  expect(detail.items.find((item) => item.groupName === '临时组合')?.groupUsage).toBe(
    '外用，每天1次'
  )

  await openApp(page, `/#/prescriptions/print?ids=${created!.id}`, '[data-testid="print-page"]')
  const frame = page.frameLocator('.print-frame')
  await expect(frame.getByText('1、阿莫西林胶囊').first()).toBeVisible()
  await expect(frame.getByText('用法：口服，每天3次').first()).toBeVisible()
  await expect(frame.getByText('用法：外用，每天1次').first()).toBeVisible()
})
