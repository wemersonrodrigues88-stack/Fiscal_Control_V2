-- Configuração persistente da identidade do aplicativo.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('sidebar_subtitle', 'Acompanhamento de execução e prazos')
ON CONFLICT(setting_key) DO UPDATE SET
  setting_value=excluded.setting_value,
  updated_at=CURRENT_TIMESTAMP;
