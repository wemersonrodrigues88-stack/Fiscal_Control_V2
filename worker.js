const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8' };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function unauthorized() {
  return json({ error: 'Não autenticado.' }, 401);
}

async function getCurrentUser(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  // Session implementation is deliberately server-side. A production session table
  // can be added without changing the API contract; no credentials are accepted from the client.
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.name, u.status, p.name AS profile
     FROM users u JOIN profiles p ON p.id = u.profile_id
     WHERE u.username = ?1 AND u.status = 'active'`
  ).bind(token).first();
  return row || null;
}

function canAccess(user, area) {
  if (!user) return false;
  if (user.profile === 'Desenvolvedor' || user.profile === 'Gestão') return true;
  return area === 'analyst' || area === 'dashboard';
}

async function audit(env, user, request, action, entityType = null, entityId = null) {
  await env.DB.prepare(
    `INSERT INTO audit_log (user_id, request_id, method, path, action, entity_type, entity_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(user?.id ?? null, crypto.randomUUID(), request.method, new URL(request.url).pathname,
    action, entityType, entityId).run();
}

async function handleApi(request, env, url) {
  const user = await getCurrentUser(request, env);
  const path = url.pathname;

  if (path === '/api/health') {
    const result = await env.DB.prepare('SELECT 1 AS ok').first();
    return json({ ok: result?.ok === 1, app: env.APP_NAME, version: env.APP_VERSION });
  }

  if (path === '/api/auth/me') {
    if (!user) return unauthorized();
    return json({ user });
  }

  if (path === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!username || !password) return json({ error: 'Usuário e senha são obrigatórios.' }, 400);

    // Password verification is intentionally isolated. Replace the seed placeholder
    // with a real password-hash workflow before production use.
    const row = await env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.status, u.password_hash, p.name AS profile
       FROM users u JOIN profiles p ON p.id = u.profile_id
       WHERE u.username = ?1 AND u.status = 'active'`
    ).bind(username).first();
    if (!row || row.password_hash !== password) return json({ error: 'Usuário ou senha inválidos.' }, 401);

    await audit(env, row, request, 'login');
    // Temporary server-recognized session token: username. Production deployment should
    // replace this with an opaque random session persisted in D1.
    return json({ token: row.username, user: { id: row.id, username: row.username, name: row.name, profile: row.profile } });
  }

  if (!user) return unauthorized();

  if (path === '/api/team' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT u.id, u.name, u.username, p.name AS profile, a.seniority,
              COUNT(DISTINCT ap.portfolio_id) AS portfolio_count
       FROM users u
       JOIN profiles p ON p.id = u.profile_id
       LEFT JOIN analysts a ON a.user_id = u.id
       LEFT JOIN analyst_portfolios ap ON ap.analyst_user_id = u.id
       WHERE u.status = 'active'
       GROUP BY u.id, u.name, u.username, p.name, a.seniority
       ORDER BY CASE p.name WHEN 'Gestão' THEN 1 WHEN 'Desenvolvedor' THEN 2 ELSE 3 END, u.name`
    ).all();
    await audit(env, user, request, 'read_team');
    return json({ data: rows.results || [] });
  }

  if (path === '/api/stores' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM stores WHERE status='active' ORDER BY name`).all();
    return json({ data: rows.results || [] });
  }

  if (path === '/api/portfolios' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT * FROM portfolios ORDER BY name`).all();
    return json({ data: rows.results || [] });
  }

  if (path === '/api/dashboard' && request.method === 'GET') {
    if (!canAccess(user, 'dashboard')) return json({ error: 'Sem permissão.' }, 403);
    const [users, stores, obligations, pending, overdue] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE status='active' AND id IN (SELECT user_id FROM analysts)`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM stores WHERE status='active'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM obligations`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM obligations WHERE status IN ('pending','in_progress')`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM obligations WHERE status='overdue'`).first()
    ]);
    return json({ data: {
      activeAnalysts: users?.n || 0,
      activeStores: stores?.n || 0,
      obligations: obligations?.n || 0,
      pending: pending?.n || 0,
      overdue: overdue?.n || 0
    }});
  }

  if (path === '/api/management/analysts' && request.method === 'GET') {
    if (!canAccess(user, 'management')) return json({ error: 'Sem permissão.' }, 403);
    const rows = await env.DB.prepare(
      `SELECT u.id, u.name, a.seniority,
              COUNT(DISTINCT ap.portfolio_id) AS portfolio_count,
              COUNT(DISTINCT o.id) AS obligation_count,
              SUM(CASE WHEN o.status IN ('pending','in_progress') THEN 1 ELSE 0 END) AS pending_count,
              SUM(CASE WHEN o.status='overdue' THEN 1 ELSE 0 END) AS overdue_count
       FROM analysts a JOIN users u ON u.id=a.user_id
       LEFT JOIN analyst_portfolios ap ON ap.analyst_user_id=u.id
       LEFT JOIN obligations o ON o.responsible_user_id=u.id
       GROUP BY u.id, u.name, a.seniority
       ORDER BY u.name`
    ).all();
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
