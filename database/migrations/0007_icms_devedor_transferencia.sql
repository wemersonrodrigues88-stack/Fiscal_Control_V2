CREATE TABLE IF NOT EXISTS icms_debtor_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  competence_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_transferencia'
    CHECK (status IN ('aguardando_transferencia','transferencia_aprovada','finalizada_devedora')),
  requested_by INTEGER,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by INTEGER,
  resolved_at TEXT,
  UNIQUE(store_id, competence_period),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_icms_debtor_requests_period_status
  ON icms_debtor_requests(competence_period, status);
