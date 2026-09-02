-- Performance migration: safe, additive indexes only.
-- No tables, columns, data or business rules are changed.
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_stores_store ON portfolio_stores(store_id, portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_stores_portfolio ON portfolio_stores(portfolio_id, store_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_owner ON portfolios(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_obligations_store_name_id ON obligations(store_id, name, id DESC);
CREATE INDEX IF NOT EXISTS idx_deadlines_obligation_due ON deadlines(obligation_id, due_date);
CREATE INDEX IF NOT EXISTS idx_users_status_profile ON users(status, profile_id);
