CREATE TABLE IF NOT EXISTS icms_debtor_requests_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  competence_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_transferencia'
    CHECK (status IN ('aguardando_transferencia','transferencia_aprovada','finalizada_devedora','solicitacao_indev')),
  requested_by INTEGER,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by INTEGER,
  resolved_at TEXT,
  UNIQUE(store_id, competence_period),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);
INSERT OR IGNORE INTO icms_debtor_requests_v2(id,store_id,competence_period,status,requested_by,requested_at,resolved_by,resolved_at)
SELECT id,store_id,competence_period,status,requested_by,requested_at,resolved_by,resolved_at FROM icms_debtor_requests;
DROP TABLE icms_debtor_requests;
ALTER TABLE icms_debtor_requests_v2 RENAME TO icms_debtor_requests;
CREATE INDEX IF NOT EXISTS idx_icms_debtor_requests_period_status
  ON icms_debtor_requests(competence_period, status);
