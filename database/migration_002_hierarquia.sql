PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO profiles (id, name, description) VALUES
  (4, 'Coordenador', 'Perfil de coordenação de equipe'),
  (5, 'Assistente', 'Perfil de apoio às atividades fiscais');

CREATE TABLE IF NOT EXISTS team_members (
  user_id INTEGER PRIMARY KEY,
  seniority TEXT CHECK (seniority IS NULL OR seniority IN ('junior','pleno','senior')),
  coordinator_user_id INTEGER,
  manager_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coordinator_user_id) REFERENCES users(id),
  FOREIGN KEY (manager_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_coordinator ON team_members(coordinator_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_manager ON team_members(manager_user_id);

UPDATE users SET profile_id = 4, updated_at = CURRENT_TIMESTAMP
WHERE username = 'leonardo';

INSERT OR IGNORE INTO team_members (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT u.id, a.seniority, a.coordinator_user_id, a.manager_user_id
FROM analysts a
JOIN users u ON u.id = a.user_id;

INSERT OR IGNORE INTO team_members (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT u.id, NULL, NULL, 2
FROM users u
WHERE u.username = 'leonardo';

INSERT OR IGNORE INTO team_members (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT u.id, NULL, 1, 2
FROM users u
WHERE u.profile_id = 1 AND u.username NOT IN ('leonardo');
