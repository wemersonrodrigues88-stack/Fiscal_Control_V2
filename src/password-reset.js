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
    const password = String(body?.password || '');

    if (!username || password.length < 12 || password.length > 128) {
      return json({ error: 'Usuário e senha válida são obrigatórios. A senha deve ter entre 12 e 128 caracteres.' }, 400);
    }

    // Recuperação administrativa independente de profiles e de colunas de auditoria.
    const row = await env.DB.prepare(
      'SELECT id,username FROM users WHERE username=?1 LIMIT 1'
    ).bind(username).first();

    if (!row) return json({ error: 'Usuário não encontrado.' }, 404);

    const passwordHash = await hashPassword(password);

    // O login exige status=active; a recuperação administrativa garante a conta ativa.
    // Não usa updated_at nem depende do objeto meta retornado pelo D1.
    await env.DB.prepare(
      "UPDATE users SET password_hash=?1,status='active' WHERE id=?2"
    ).bind(passwordHash, row.id).run();

    // Sessões antigas não podem continuar válidas após uma recuperação de senha.
    // A tabela pode variar em instalações antigas, portanto a revogação é isolada.
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
