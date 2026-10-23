import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export interface DataPaths {
  dataDir: string
  dbPath: string
  backupsDir: string
  logsDir: string
  runtimeDir: string
}

export function resolveDataDir(): string {
  const override = process.env.YANXIA_DATA_DIR
  if (override && override.trim()) {
    return resolve(override)
  }
  if (app.isPackaged) {
    return join(dirname(app.getPath('exe')), 'data')
  }
  return resolve(process.cwd(), '.dev-data')
}

export function getDataPaths(): DataPaths {
  const dataDir = resolveDataDir()
  return {
    dataDir,
    dbPath: join(dataDir, 'clinic.db'),
    backupsDir: join(dataDir, 'backups'),
    logsDir: join(dataDir, 'logs'),
    runtimeDir: join(dataDir, 'runtime')
  }
}

export function ensureDataDirs(paths: DataPaths = getDataPaths()): DataPaths {
  for (const dir of [paths.dataDir, paths.backupsDir, paths.logsDir, paths.runtimeDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
  const probe = join(paths.dataDir, '.write-probe')
  try {
    writeFileSync(probe, 'ok', 'utf8')
    unlinkSync(probe)
  } catch (error) {
    throw new Error(`数据目录不可写：${paths.dataDir}\n${(error as Error).message}`, {
      cause: error
    })
  }
  return paths
}
