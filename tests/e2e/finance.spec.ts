import { expect, test } from '@playwright/test'
import { apiCall, openApp, resetData } from './helpers/launch'

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const thisYear = String(now.getFullYear())

const P2 = {
  patientName: '李国强',
  gender: '男',
  age: '45',
  diagnosis: '急性支气管炎',
  issueDate: today,
  rp: '多饮水，注意休息。',
  doctor: '王医生',
  items: [
    { drugId: 1, qty: 1, usage: '口服', frequency: '每日3次' },
    { drugId: 2, qty: 1, usage: '口服', frequency: '每日2次' },
    { drugId: 3, qty: 1, usage: '静脉滴注', frequency: '每日1次' }
  ],
  injectionFeeCents: 0
}

const P3 = {
  patientName: '王小明',
  gender: '男',
  age: '8个月',
  diagnosis: '上呼吸道感染',
  issueDate: today,
  rp: '按医嘱服用。',
  doctor: '李医生',
  items: [{ drugId: 1, qty: 2, usage: '口服', frequency: '每日2次' }],
  injectionFeeCents: 0,
  manualDrugAmountCents: 3000
}

test.beforeEach(async ({ request }) => {
  await resetData(request)
  await apiCall(request, 'prescriptions', 'create', [P2, true])
  await apiCall(request, 'prescriptions', 'create', [P3, false])
})

test('日/周/月/年账本、图表与明细抽屉', async ({ page }) => {
  await openApp(page, '/#/finance', '[data-testid="finance-page"]')

  await expect(page.getByTestId('finance-revenue')).toContainText('¥133.00')
  await expect(page.getByTestId('finance-cost')).toContainText('¥52.00')
  await expect(page.getByTestId('finance-profit')).toContainText('+¥81.00')
  await expect(page.getByTestId('finance-count')).toContainText('3 张')

  await page.getByTestId('finance-row-p-1').click()
  await expect(page.getByTestId('finance-detail-drawer')).toBeVisible()
  await expect(page.getByTestId('finance-detail-drawer')).toContainText('张秀兰')
  await page.getByTestId('finance-detail-drawer').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('finance-tab-week').click()
  await expect(page.getByTestId('finance-revenue')).toContainText('¥133.00')
  await expect(page.getByTestId('finance-cost')).toContainText('¥52.00')
  await expect(page.getByTestId('finance-profit')).toContainText('+¥81.00')
  await expect(page.getByTestId('finance-count')).toContainText('3 张')
  await expect(page.getByTestId('finance-chart')).toBeVisible()
  await expect(page.getByTestId(`finance-row-${today}`)).toBeVisible()

  await page.getByTestId('finance-tab-month').click()
  await expect(page.getByTestId('finance-chart')).toBeVisible()
  await page.getByTestId('finance-tab-year').click()
  await expect(page.getByTestId('finance-period-label')).toContainText(`${thisYear}年`)
})
