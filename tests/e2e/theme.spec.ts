import { expect, test } from '@playwright/test'
import { openApp, resetData } from './helpers/launch'

test.beforeEach(async ({ request }) => {
  await resetData(request)
})

test('处方首页与三套主题切换', async ({ page }) => {
  await openApp(page)
  await expect(page.getByTestId('prescription-page')).toBeVisible()
  await expect(page.getByText('张秀兰').first()).toBeVisible()

  await page.getByTestId('theme-button').click()
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByTestId('theme-button').click()
  await page.getByTestId('theme-reading').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'reading')

  await page.reload()
  await page.waitForSelector('[data-testid="prescription-page"]')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'reading')
})
