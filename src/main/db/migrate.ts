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
      db.run('PRAGMA user_version = 3')
      version = 3
    } else {
      if (version < 2) {
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
        version = 2
      }
      if (version < 3) {
        db.run('ALTER TABLE drugs ADD COLUMN stock_units INTEGER NOT NULL DEFAULT 0')
        const unitRows = db.exec('SELECT drug_id, factor FROM drug_units')
        const factorsByDrug = new Map<number, number>()
        for (const [drugId, factor] of unitRows[0]?.values ?? []) {
          factorsByDrug.set(Number(drugId), (factorsByDrug.get(Number(drugId)) ?? 1) * Number(factor))
        }
        const drugRows = db.exec('SELECT id, stock_qty FROM drugs')
        for (const [id, stockQty] of drugRows[0]?.values ?? []) {
          const totalFactor = factorsByDrug.get(Number(id)) ?? 1
          db.run('UPDATE drugs SET stock_units = ? WHERE id = ?', [
            Math.round(Number(stockQty) * totalFactor),
            Number(id)
          ])
        }
        db.run('PRAGMA user_version = 3')
        version = 3
      }
      db.run('PRAGMA user_version = 3')
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
