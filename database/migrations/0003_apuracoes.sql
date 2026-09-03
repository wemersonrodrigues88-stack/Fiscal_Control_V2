CREATE TABLE IF NOT EXISTS execution_control (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  obligation TEXT NOT NULL,
  competence_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  started_at TEXT,
  analyzing_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  UNIQUE(store_id, obligation, competence_period)
);

CREATE TABLE IF NOT EXISTS icms_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  competence_period TEXT NOT NULL,
  item_key TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  UNIQUE(store_id, competence_period, item_key)
);
