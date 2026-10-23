export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  inbound_date TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  warning_qty INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  indications TEXT NOT NULL DEFAULT '',
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  purchase_date TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('男', '女')),
  age TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  rp TEXT NOT NULL,
  doctor TEXT NOT NULL,
  drug_amount_cents INTEGER NOT NULL,
  injection_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  drug_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  usage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL,
  warning_qty INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'stock_low',
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drugs_status_name ON drugs(status, name);
CREATE INDEX IF NOT EXISTS idx_drugs_low ON drugs(status, stock_qty, warning_qty);
CREATE INDEX IF NOT EXISTS idx_prescriptions_issue_date ON prescriptions(issue_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_name);
CREATE INDEX IF NOT EXISTS idx_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_items_drug ON prescription_items(drug_id);
CREATE INDEX IF NOT EXISTS idx_purchases_drug_date ON purchases(drug_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_notifications_drug_read ON notifications(drug_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
`
