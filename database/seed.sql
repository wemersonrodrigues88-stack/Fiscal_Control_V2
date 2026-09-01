INSERT OR IGNORE INTO profiles (id, name, description) VALUES
  (1, 'Analista', 'Perfil operacional do analista fiscal'),
  (2, 'Gestão', 'Perfil de gestão e acompanhamento'),
  (3, 'Desenvolvedor', 'Privilégio técnico com acesso amplo'),
  (4, 'Coordenador', 'Perfil de coordenação de equipe'),
  (5, 'Assistente', 'Perfil de apoio às atividades fiscais');

-- Senhas iniciais são placeholders de hash e devem ser substituídas por hashes reais
-- através do fluxo de provisionamento seguro antes do uso em produção.
INSERT OR IGNORE INTO users (username, password_hash, name, profile_id, status) VALUES
  ('leonardo', 'REPLACE_WITH_SECURE_HASH', 'Leonardo', 4, 'active'),
  ('daniela', 'REPLACE_WITH_SECURE_HASH', 'Daniela', 2, 'active'),
  ('wemerson', 'REPLACE_WITH_SECURE_HASH', 'Wemerson', 3, 'active'),
  ('juliane', 'REPLACE_WITH_SECURE_HASH', 'Juliane', 1, 'active'),
  ('luanna', 'REPLACE_WITH_SECURE_HASH', 'Luanna', 1, 'active'),
  ('dennys', 'REPLACE_WITH_SECURE_HASH', 'Dennys', 1, 'active'),
  ('julia', 'REPLACE_WITH_SECURE_HASH', 'Julia', 1, 'active'),
  ('taciana', 'REPLACE_WITH_SECURE_HASH', 'Taciana', 1, 'active'),
  ('livia', 'REPLACE_WITH_SECURE_HASH', 'Lívia', 1, 'active'),
  ('augustus', 'REPLACE_WITH_SECURE_HASH', 'Augustus', 1, 'active'),
  ('gustavo', 'REPLACE_WITH_SECURE_HASH', 'Gustavo', 1, 'active'),
  ('angela', 'REPLACE_WITH_SECURE_HASH', 'Angela', 1, 'active');

INSERT OR IGNORE INTO analysts (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT u.id, CASE u.username
  WHEN 'juliane' THEN 'senior'
  WHEN 'luanna' THEN 'junior'
  WHEN 'dennys' THEN 'senior'
  WHEN 'julia' THEN 'pleno'
  WHEN 'taciana' THEN 'pleno'
  WHEN 'livia' THEN 'senior'
  WHEN 'augustus' THEN 'pleno'
  WHEN 'gustavo' THEN 'pleno'
  WHEN 'angela' THEN 'pleno'
END,
(SELECT id FROM users WHERE username='leonardo'),
(SELECT id FROM users WHERE username='daniela')
FROM users u WHERE u.profile_id = 1;

INSERT OR IGNORE INTO team_members (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT u.id, a.seniority, a.coordinator_user_id, a.manager_user_id
FROM analysts a JOIN users u ON u.id=a.user_id;

INSERT OR IGNORE INTO team_members (user_id, seniority, coordinator_user_id, manager_user_id)
SELECT id, NULL, NULL, (SELECT id FROM users WHERE username='daniela')
FROM users WHERE username='leonardo';
