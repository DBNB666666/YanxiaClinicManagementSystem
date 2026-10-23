import fs from 'node:fs'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import type { SqliteStore } from '../db/store'

export interface BackupStatus {
  lastBackupAt: string | null
  created: boolean
}

function todayName(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `clinic-${year}-${month}-${day}.db`
}

export function ensureDailyBackup(
  store: SqliteStore,
  backupsDir: string,
  keep = 7
): BackupStatus {
  fs.mkdirSync(backupsDir, { recursive: true })
  const target = path.join(backupsDir, todayName())
  let created = false
  if (!fs.existsSync(target)) {
    writeFileAtomic.sync(target, Buffer.from(store.exportBytes()))
    created = true
  }

  const files = fs
    .readdirSync(backupsDir)
    .filter((file) => /^clinic-\d{4}-\d{2}-\d{2}\.db$/.test(file))
    .sort()
  for (const file of files.slice(0, Math.max(0, files.length - keep))) {
    fs.rmSync(path.join(backupsDir, file), { force: true })
  }

  return { lastBackupAt: getLastBackupAt(backupsDir), created }
}

export function getLastBackupAt(backupsDir: string): string | null {
  if (!fs.existsSync(backupsDir)) return null
  const files = fs
    .readdirSync(backupsDir)
    .filter((file) => /^clinic-\d{4}-\d{2}-\d{2}\.db$/.test(file))
    .sort()
  if (!files.length) return null
  const stat = fs.statSync(path.join(backupsDir, files[files.length - 1]))
  return stat.mtime.toISOString()
}
