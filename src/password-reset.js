const PASSWORD_ITERATIONS = 120000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8' }
  });
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

export async function handlePasswordReset(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/auth/reset-password' || request.method !== 'POST') return null;

  const configuredSecret = env.BOOTSTRAP_SECRET || '';
  const suppliedSecret = request.headers.get('X-Bootstrap-Secret') || '';
  if (!configuredSecret || !constantTimeEqual(
    new TextEncoder().encode(suppliedSecret),
    new TextEncoder().encode(configuredSecret)
  )) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const body = await request.json().catch(() => null);
  const username = String(body?.username || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!username || password.length < 12 || password.length > 128) {
    return json({ error: 'Usuário e senha válida são obrigatórios. A senha deve ter entre 12 e 128 caracteres.' }, 400);
  }

  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.name,p.name AS profile
    FROM users u
    JOIN profiles p ON p.id=u.profile_id
    WHERE u.username=?1 AND u.status='active'
  `).bind(username).first();

  if (!row) return json({ error: 'Usuário não encontrado.' }, 404);

  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'UPDATE users SET password_hash=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2'
  ).bind(passwordHash, row.id).run();

  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(row.id).run();

  await env.DB.prepare(`
    INSERT INTO audit_log
      (user_id,request_id,method,path,action,entity_type,entity_id,metadata_json)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
  `).bind(
    null,
    crypto.randomUUID(),
    request.method,
    url.pathname,
    'bootstrap_reset_password',
    'user',
    row.id,
    JSON.stringify({ username: row.username })
  ).run();

  return json({ ok: true, username: row.username, sessions_revoked: true });
}
