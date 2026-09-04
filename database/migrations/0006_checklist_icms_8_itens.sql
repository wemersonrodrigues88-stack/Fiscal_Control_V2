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

UPDATE icms_checklist
SET item_key='controle_fechado'
WHERE item_key='contabilizacao';
