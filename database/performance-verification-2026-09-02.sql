-- Fiscal Control V2 — verificação da otimização
-- Executar após aplicar performance-optimization-2026-09-02.sql no D1.
-- Somente leitura: não altera dados nem estrutura.

SELECT name, tbl_name, sql
FROM sqlite_master
WHERE type='index'
  AND name IN (
    'idx_history_execution_entity_created',
    'idx_history_entity_created',
    'idx_deadlines_status',
    'idx_deadlines_status_obligation_due'
  )
ORDER BY name;

EXPLAIN QUERY PLAN
SELECT entity_id, created_at, description
FROM history
WHERE entity_type='execution'
ORDER BY created_at DESC
LIMIT 100;

EXPLAIN QUERY PLAN
SELECT id, obligation, due_date, status
FROM deadlines
WHERE status='late'
ORDER BY due_date;
