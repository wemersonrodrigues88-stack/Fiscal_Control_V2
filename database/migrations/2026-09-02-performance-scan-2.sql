-- Índices adicionais encontrados na segunda varredura de desempenho.
CREATE INDEX IF NOT EXISTS idx_history_type_created ON history(entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status_due ON deadlines(status, due_date);
