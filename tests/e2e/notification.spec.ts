import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
  await apiCall(request, 'prescriptions', 'create', [
    {
      patientName: '通知患者',
      gender: '女',
      age: '50',
      diagnosis: '测试',
      issueDate: '2026-10-23',
      rp: '测试',
      doctor: '王医生',
      items: [{ drugId: 1, qty: 5, usage: '口服', frequency: '每日1次' }],
      injectionFeeCents: 0
    },
    false
  ])
})

test('铃铛未读、通知抽屉与跳转药品详情', async ({ page }) => {
  await openApp(page)
  await expect(page.getByTestId('notification-badge')).toHaveText('1')
  await page.getByTestId('notification-button').click()
  await expect(page.getByTestId('notification-drawer')).toBeVisible()
  await expect(page.getByTestId('notification-drawer')).toContainText('阿莫西林胶囊')

  await page.locator('.notification-item').first().click()
  await expect(page).toHaveURL(/#\/pharmacy\/1/)
  await expect(page.getByTestId('drug-detail-page')).toBeVisible()
  await expect(page.getByTestId('drug-detail-page')).toContainText('阿莫西林胶囊')
  await expect(page.getByTestId('notification-badge')).toHaveCount(0)
})
