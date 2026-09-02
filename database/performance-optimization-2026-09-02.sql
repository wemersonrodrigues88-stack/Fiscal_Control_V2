-- Fiscal Control V2 — otimização controlada de performance
-- Base: commit congelado 44af446ec938bdcc56c81a42c122173caed8044c
-- Regra: somente índices auxiliares; nenhum dado, regra, endpoint ou interface é alterado.
-- Executar no D1 de produção antes de comparar tempos de resposta.

PRAGMA foreign_keys = ON;

-- A tela Histórico filtra por tipo/entidade e ordena pelos registros mais recentes.
CREATE INDEX IF NOT EXISTS idx_history_execution_entity_created
  ON history(entity_type, entity_id, created_at DESC);

-- Consultas de histórico sem filtro de loja ainda restringem por entity_type
-- e ordenam pela data de criação.
CREATE INDEX IF NOT EXISTS idx_history_entity_created
  ON history(entity_type, created_at DESC);

-- Dashboard/Prazos conta registros atrasados por status.
CREATE INDEX IF NOT EXISTS idx_deadlines_status
  ON deadlines(status);

-- Consultas de deadlines fazem JOIN pelo obligation_id e ordenam pelo vencimento.
CREATE INDEX IF NOT EXISTS idx_deadlines_status_obligation_due
  ON deadlines(status, obligation_id, due_date);
