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
      db.run('PRAGMA user_version = 2')
      version = 2
    } else if (version < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS drug_units (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
          unit TEXT NOT NULL,
          factor REAL NOT NULL CHECK (factor > 0),
          price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
          cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_drug_units_drug ON drug_units(drug_id, sort_order);
      `)
      db.run('ALTER TABLE prescription_items ADD COLUMN unit_factor REAL NOT NULL DEFAULT 1')
      db.run('PRAGMA user_version = 2')
      version = 2
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
