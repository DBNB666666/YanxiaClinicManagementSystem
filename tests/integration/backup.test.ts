import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureDailyBackup, getLastBackupAt } from '../../src/main/services/backupService'
import { createTestContext, seedBase, type TestContext } from '../helpers/testStore'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
  seedBase(ctx.service)
})

afterEach(() => {
  ctx.cleanup()
})

describe('backup', () => {
  it('每天只建一份备份并返回时间', () => {
    const backupsDir = join(ctx.dir, 'backups')
    const first = ensureDailyBackup(ctx.store, backupsDir)
    expect(first.created).toBe(true)
    expect(first.lastBackupAt).not.toBeNull()
    expect(readdirSync(backupsDir).some((file) => file.endsWith('.db'))).toBe(true)
    const second = ensureDailyBackup(ctx.store, backupsDir)
    expect(second.created).toBe(false)
    expect(getLastBackupAt(backupsDir)).toBe(first.lastBackupAt)
  })

  it('最多保留 7 份', () => {
    const backupsDir = join(ctx.dir, 'backups')
    ensureDailyBackup(ctx.store, backupsDir)
    for (let day = 1; day <= 8; day += 1) {
      writeFileSync(join(backupsDir, `clinic-2020-01-0${day}.db`), 'x')
    }
    ensureDailyBackup(ctx.store, backupsDir)
    const files = readdirSync(backupsDir).filter((file) => file.endsWith('.db'))
    expect(files.length).toBeLessThanOrEqual(7)
  })
})
