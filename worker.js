const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8' };
const PASSWORD_ITERATIONS = 120000;
const SESSION_HOURS = 8;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function unauthorized() { return json({ error: 'Não autenticado.' }, 401); }
function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 500000) return false;
  let salt, expected;
  try { salt = fromBase64Url(parts[2]); expected = fromBase64Url(parts[3]); } catch { return false; }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, expected.length * 8);
  return constantTimeEqual(new Uint8Array(bits), expected);
}
async function createSession(env, userId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64Url(tokenBytes);
  const tokenHash = await sha256Base64Url(token);
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?1, ?2, ?3)').bind(userId, tokenHash, expires).run();
  return token;
}
async function getCurrentUser(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const tokenHash = await sha256Base64Url(token);
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.name,u.status,p.name AS profile,
           tm.seniority,tm.coordinator_user_id,tm.manager_user_id
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    JOIN profiles p ON p.id=u.profile_id
    LEFT JOIN team_members tm ON tm.user_id=u.id
    WHERE s.token_hash=?1 AND s.revoked_at IS NULL
      AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'
  `).bind(tokenHash).first();
  if (row) await env.DB.prepare('UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(tokenHash).run();
  return row || null;
}
function isManagement(user) { return ['Desenvolvedor', 'Gestão'].includes(user?.profile); }
function canAccess(user, area) {
  if (!user) return false;
  if (isManagement(user)) return true;
  if (user.profile === 'Coordenador') return ['dashboard', 'team', 'analyst'].includes(area);
  if (user.profile === 'Analista' || user.profile === 'Assistente') return ['dashboard', 'team', 'analyst'].includes(area);
  return false;
}
async function audit(env, user, request, action, entityType = null, entityId = null) {
  await env.DB.prepare(`INSERT INTO audit_log (user_id,request_id,method,path,action,entity_type,entity_id) VALUES (?1,?2,?3,?4,?5,?6,?7)`)
    .bind(user?.id ?? null, crypto.randomUUID(), request.method, new URL(request.url).pathname, action, entityType, entityId).run();
}

async function handleApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/health') {
    const result = await env.DB.prepare('SELECT 1 AS ok').first();
    return json({ ok: result?.ok === 1, app: env.APP_NAME, version: env.APP_VERSION });
  }

  if (path === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!username || !password) return json({ error: 'Usuário e senha são obrigatórios.' }, 400);
    const row = await env.DB.prepare(`SELECT u.id,u.username,u.name,u.status,u.password_hash,p.name AS profile FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.username=?1 AND u.status='active'`).bind(username).first();
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: 'Usuário ou senha inválidos.' }, 401);
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP OR revoked_at IS NOT NULL').run();
    const token = await createSession(env, row.id);
    await audit(env, row, request, 'login');
    return json({ token, user: { id: row.id, username: row.username, name: row.name, profile: row.profile } });
  }

  if (path === '/api/auth/provision-password' && request.method === 'POST') {
    const configuredSecret = env.BOOTSTRAP_SECRET;
    const suppliedSecret = request.headers.get('X-Bootstrap-Secret') || '';
    if (!configuredSecret || !constantTimeEqual(new TextEncoder().encode(suppliedSecret), new TextEncoder().encode(configuredSecret))) return json({ error: 'Não autorizado.' }, 401);
    const body = await request.json().catch(() => null);
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!username || password.length < 12) return json({ error: 'Usuário e senha válida são obrigatórios. A senha deve ter ao menos 12 caracteres.' }, 400);
    const row = await env.DB.prepare("SELECT id,password_hash FROM users WHERE username=?1 AND status='active'").bind(username).first();
    if (!row) return json({ error: 'Usuário não encontrado.' }, 404);
    if (!String(row.password_hash).startsWith('REPLACE_WITH_SECURE_HASH')) return json({ error: 'A senha deste usuário já foi provisionada.' }, 409);
    const passwordHash = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(passwordHash, row.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(row.id).run();
    return json({ ok: true, username });
  }

  if (path === '/api/auth/me') {
    const user = await getCurrentUser(request, env);
    if (!user) return unauthorized();
    return json({ user });
  }

  const user = await getCurrentUser(request, env);
  if (!user) return unauthorized();

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const auth = request.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (token) {
      const tokenHash = await sha256Base64Url(token);
      await env.DB.prepare('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(tokenHash).run();
    }
    await audit(env, user, request, 'logout');
    return json({ ok: true });
  }

  if (path === '/api/team' && request.method === 'GET') {
    if (!canAccess(user, 'team')) return json({ error: 'Sem permissão.' }, 403);
    let sql = `
      SELECT u.id,u.name,u.username,p.name AS profile,tm.seniority,
             tm.coordinator_user_id,tm.manager_user_id,
             c.name AS coordinator_name,m.name AS manager_name,
             COUNT(DISTINCT ap.portfolio_id) AS portfolio_count
      FROM users u
      JOIN profiles p ON p.id=u.profile_id
      LEFT JOIN team_members tm ON tm.user_id=u.id
      LEFT JOIN users c ON c.id=tm.coordinator_user_id
      LEFT JOIN users m ON m.id=tm.manager_user_id
      LEFT JOIN analyst_portfolios ap ON ap.analyst_user_id=u.id
      WHERE u.status='active'
    `;
    const params = [];
    if (user.profile === 'Coordenador') {
      sql += ' AND (u.id=?1 OR tm.coordinator_user_id=?1)';
      params.push(user.id);
    } else if (user.profile === 'Analista' || user.profile === 'Assistente') {
      sql += ' AND u.id=?1';
      params.push(user.id);
    }
    sql += ` GROUP BY u.id,u.name,u.username,p.name,tm.seniority,tm.coordinator_user_id,tm.manager_user_id,c.name,m.name
             ORDER BY CASE p.name WHEN 'Gestão' THEN 1 WHEN 'Coordenador' THEN 2 WHEN 'Analista' THEN 3 WHEN 'Assistente' THEN 4 ELSE 5 END,u.name`;
    const result = params.length ? await env.DB.prepare(sql).bind(...params).all() : await env.DB.prepare(sql).all();
    await audit(env, user, request, 'read_team');
    return json({ data: result.results || [] });
  }

  if (path === '/api/team/create' && request.method === 'POST') {
    if (!isManagement(user)) return json({ error: 'Sem permissão.' }, 403);
    const body = await request.json().catch(() => null);
    const name = String(body?.name || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const profile = String(body?.profile || '').trim();
    const seniority = body?.seniority ? String(body.seniority).trim().toLowerCase() : null;
    const password = String(body?.password || '');
    const coordinatorUserId = body?.coordinator_user_id ? Number(body.coordinator_user_id) : null;
    const managerUserId = body?.manager_user_id ? Number(body.manager_user_id) : user.profile === 'Gestão' ? user.id : null;

    if (!name || !username || !password) return json({ error: 'Nome, usuário e senha são obrigatórios.' }, 400);
    if (!['Assistente', 'Analista', 'Coordenador'].includes(profile)) return json({ error: 'Perfil inválido.' }, 400);
    if (password.length < 12) return json({ error: 'A senha deve ter ao menos 12 caracteres.' }, 400);
    if (seniority && !['junior', 'pleno', 'senior'].includes(seniority)) return json({ error: 'Senioridade inválida.' }, 400);
    if ((profile === 'Analista' || profile === 'Assistente') && !coordinatorUserId) return json({ error: 'Informe o coordenador responsável.' }, 400);
    if (!managerUserId) return json({ error: 'Informe o gerente responsável.' }, 400);

    const profileRow = await env.DB.prepare('SELECT id FROM profiles WHERE name=?1').bind(profile).first();
    if (!profileRow) return json({ error: 'Perfil não configurado.' }, 500);
    const duplicate = await env.DB.prepare('SELECT id FROM users WHERE username=?1').bind(username).first();
    if (duplicate) return json({ error: 'Este usuário já existe.' }, 409);

    const passwordHash = await hashPassword(password);
    const insertUser = await env.DB.prepare('INSERT INTO users (username,password_hash,name,profile_id,status) VALUES (?1,?2,?3,?4,\'active\')')
      .bind(username, passwordHash, name, profileRow.id).run();
    const newUserId = insertUser.meta.last_row_id;

    await env.DB.prepare(`INSERT INTO team_members (user_id,seniority,coordinator_user_id,manager_user_id) VALUES (?1,?2,?3,?4)`)
      .bind(newUserId, profile === 'Coordenador' ? null : seniority, profile === 'Coordenador' ? null : coordinatorUserId, managerUserId).run();

    if (profile === 'Analista') {
      await env.DB.prepare('INSERT OR IGNORE INTO analysts (user_id,seniority,coordinator_user_id,manager_user_id) VALUES (?1,?2,?3,?4)')
        .bind(newUserId, seniority, coordinatorUserId, managerUserId).run();
    }
    await audit(env, user, request, 'create_team_member', 'user', newUserId);
    return json({ ok: true, user_id: newUserId }, 201);
  }

  if (path === '/api/team/options' && request.method === 'GET') {
    if (!isManagement(user)) return json({ error: 'Sem permissão.' }, 403);
    const [coordinators, managers] = await Promise.all([
      env.DB.prepare("SELECT u.id,u.name FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.status='active' AND p.name='Coordenador' ORDER BY u.name").all(),
      env.DB.prepare("SELECT u.id,u.name FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.status='active' AND p.name='Gestão' ORDER BY u.name").all()
    ]);
    return json({ coordinators: coordinators.results || [], managers: managers.results || [] });
  }

  if (path === '/api/stores' && request.method === 'GET') {
    if (!canAccess(user, 'dashboard')) return json({ error: 'Sem permissão.' }, 403);
    const rows = await env.DB.prepare("SELECT * FROM stores WHERE status='active' ORDER BY name").all();
    return json({ data: rows.results || [] });
  }
  if (path === '/api/portfolios' && request.method === 'GET') {
    if (!canAccess(user, 'dashboard')) return json({ error: 'Sem permissão.' }, 403);
    const rows = await env.DB.prepare('SELECT * FROM portfolios ORDER BY name').all();
    return json({ data: rows.results || [] });
  }
  if (path === '/api/dashboard' && request.method === 'GET') {
    if (!canAccess(user, 'dashboard')) return json({ error: 'Sem permissão.' }, 403);
    const [users,stores,obligations,pending,overdue] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE status='active' AND profile_id=(SELECT id FROM profiles WHERE name='Analista')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM stores WHERE status='active'").first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM obligations').first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM obligations WHERE status IN ('pending','in_progress')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM obligations WHERE status='overdue'").first()
    ]);
    return json({ data: { activeAnalysts: users?.n || 0, activeStores: stores?.n || 0, obligations: obligations?.n || 0, pending: pending?.n || 0, overdue: overdue?.n || 0 } });
  }
  if (path === '/api/management/analysts' && request.method === 'GET') {
    if (!isManagement(user)) return json({ error: 'Sem permissão.' }, 403);
    const rows = await env.DB.prepare(`
      SELECT u.id,u.name,p.name AS profile,tm.seniority,tm.coordinator_user_id,tm.manager_user_id,
             c.name AS coordinator_name,m.name AS manager_name,
             COUNT(DISTINCT ap.portfolio_id) AS portfolio_count,
             COUNT(DISTINCT o.id) AS obligation_count,
             SUM(CASE WHEN o.status IN ('pending','in_progress') THEN 1 ELSE 0 END) AS pending_count,
             SUM(CASE WHEN o.status='overdue' THEN 1 ELSE 0 END) AS overdue_count
      FROM users u
      JOIN profiles p ON p.id=u.profile_id
      LEFT JOIN team_members tm ON tm.user_id=u.id
      LEFT JOIN users c ON c.id=tm.coordinator_user_id
      LEFT JOIN users m ON m.id=tm.manager_user_id
      LEFT JOIN analyst_portfolios ap ON ap.analyst_user_id=u.id
      LEFT JOIN obligations o ON o.responsible_user_id=u.id
      WHERE u.status='active' AND p.name='Analista'
      GROUP BY u.id,u.name,p.name,tm.seniority,tm.coordinator_user_id,tm.manager_user_id,c.name,m.name
      ORDER BY u.name
    `).all();
    return json({ data: rows.results || [] });
  }
  return json({ error: 'Rota não encontrada.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: 'Erro interno do servidor.' }, 500);
    }
  }
};
