function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8' }
  });
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function isValidPasswordHash(value) {
  const parts = String(value || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 500000) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2]) || !/^[A-Za-z0-9_-]+$/.test(parts[3])) return false;
  return true;
}

export async function handlePasswordReset(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/auth/reset-password' || request.method !== 'POST') return null;

  try {
    const configuredSecret = String(env.BOOTSTRAP_SECRET || '');
    const suppliedSecret = request.headers.get('X-Bootstrap-Secret') || '';

    if (!configuredSecret || !constantTimeEqual(
      new TextEncoder().encode(suppliedSecret),
      new TextEncoder().encode(configuredSecret)
    )) {
      return json({ error: 'Não autorizado.' }, 401);
    }

    if (!env.DB) {
      console.error('Password reset failed: D1 binding DB is unavailable.');
      return json({ error: 'Serviço de banco de dados indisponível.' }, 503);
    }

    const body = await request.json().catch(() => null);
    const username = String(body?.username || '').trim().toLowerCase();
    const passwordHash = String(body?.password_hash || '');

    if (!username || !isValidPasswordHash(passwordHash)) {
      return json({ error: 'Dados de recuperação inválidos.' }, 400);
    }

    const row = await env.DB.prepare(
      'SELECT id,username FROM users WHERE username=?1 LIMIT 1'
    ).bind(username).first();

    if (!row) return json({ error: 'Usuário não encontrado.' }, 404);

    // O PBKDF2 é calculado no navegador; o Worker somente valida e grava o hash.
    // Isso evita estourar o limite de CPU de uma requisição do Worker.
    await env.DB.prepare(
      'UPDATE users SET password_hash=?1 WHERE id=?2'
    ).bind(passwordHash, row.id).run();

    try {
      await env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(row.id).run();
    } catch (sessionError) {
      console.warn('Password reset: sessions could not be revoked.', sessionError);
    }

    return json({ ok: true, username: row.username, sessions_revoked: true });
  } catch (error) {
    console.error('Password reset failed:', error);
    return json({ error: 'Não foi possível configurar a senha neste momento.' }, 500);
  }
}
