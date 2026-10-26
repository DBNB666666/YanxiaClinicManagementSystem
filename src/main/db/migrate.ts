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
      db.run('PRAGMA user_version = 5')
      version = 5
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
      if (version < 4) {
        db.run('ALTER TABLE prescriptions ADD COLUMN fee_cents INTEGER NOT NULL DEFAULT 0')
        db.run('UPDATE prescriptions SET fee_cents = total_cents WHERE fee_cents = 0')
        db.run('PRAGMA user_version = 4')
        version = 4
      }
      if (version < 5) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS medication_combos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS medication_combo_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            combo_id INTEGER NOT NULL REFERENCES medication_combos(id) ON DELETE CASCADE,
            drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
            qty INTEGER NOT NULL CHECK (qty > 0),
            unit TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON medication_combo_items(combo_id, sort_order);
        `)
        db.run("ALTER TABLE prescription_items ADD COLUMN group_key TEXT NOT NULL DEFAULT ''")
        db.run("ALTER TABLE prescription_items ADD COLUMN group_name TEXT NOT NULL DEFAULT ''")
        db.run("ALTER TABLE prescription_items ADD COLUMN group_usage TEXT NOT NULL DEFAULT ''")
        db.run('PRAGMA user_version = 5')
        version = 5
      }
      db.run('PRAGMA user_version = 5')
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
