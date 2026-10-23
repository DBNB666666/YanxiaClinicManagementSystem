import type initSqlJs from 'sql.js'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'

type SqlDatabase = initSqlJs.Database

function readUserVersion(db: SqlDatabase): number {
  const result = db.exec('PRAGMA user_version')
  if (!result.length || !result[0].values.length) return 0
  return Number(result[0].values[0][0] ?? 0)
}

export function migrate(db: SqlDatabase): number {
  let version = readUserVersion(db)
  if (version >= SCHEMA_VERSION) return version

  db.run('BEGIN IMMEDIATE')
  try {
    if (version < 1) {
      db.exec(SCHEMA_SQL)
      db.run('PRAGMA user_version = 1')
      version = 1
    }
    db.run('COMMIT')
    return version
  } catch (error) {
    try {
      db.run('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    throw error
  }
}
