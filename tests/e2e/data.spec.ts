import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { openApp, waitForToast } from './helpers/launch'

test('数据管理可备份、导入并设置提醒周期', async ({ page }) => {
  await openApp(page, '/#/prescriptions', '[data-testid="prescription-page"]')
  await expect(page.getByTestId('backup-due-dot')).toBeVisible()

  const rightItems = page.locator('.topbar-right > *')
  await expect(rightItems.nth(0)).toHaveAttribute('data-testid', 'data-management-button')
  await expect(rightItems.nth(1).locator('.theme-button')).toBeVisible()

  await page.getByTestId('data-management-button').click()
  await expect(page.getByTestId('data-management-dialog')).toBeVisible()
  await expect(page.getByTestId('backup-due-alert')).toBeVisible()

  await page.getByTestId('backup-interval').fill('10')
  await page.getByTestId('save-backup-interval').click()
  await waitForToast(page, '备份提醒周期已保存')
  await expect(page.getByTestId('backup-interval')).toHaveValue('10')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('backup-data').click()
  const download = await downloadPromise
  await waitForToast(page, '备份文件已生成')
  await expect(page.getByTestId('last-backup-at')).not.toHaveText('从未备份')
  const path = await download.path()
  expect(path).toBeTruthy()
  const backupText = readFileSync(path!, 'utf8')
  expect(backupText).toContain('yanxia-clinic-backup')

  await page.getByTestId('import-file').setInputFiles({
    name: 'backup.yxbackup',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText)
  })
  await waitForToast(page, '导入完成')
  await expect(page.getByTestId('data-management-dialog')).toBeVisible()

  await page.getByTestId('data-management-dialog').getByRole('button', { name: '关闭', exact: true }).last().click()
  await page.getByTestId('data-management-button').click()
  await expect(page.getByTestId('backup-due-alert')).toHaveCount(0)
})
