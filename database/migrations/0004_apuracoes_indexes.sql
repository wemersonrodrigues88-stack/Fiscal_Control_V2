CREATE INDEX IF NOT EXISTS idx_execution_control_period_store_obligation ON execution_control(competence_period, store_id, obligation);
CREATE INDEX IF NOT EXISTS idx_apuracoes_flow_period_store_obligation ON apuracoes_flow(competence_period, store_id, obligation);
CREATE INDEX IF NOT EXISTS idx_portfolio_stores_store_portfolio ON portfolio_stores(store_id, portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_owner ON portfolios(owner_user_id, id);
CREATE INDEX IF NOT EXISTS idx_obligations_store_name_id ON obligations(store_id, name, id DESC);
