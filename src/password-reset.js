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

async function hashToken(token) {
  const data = new TextEncoder().encode(String(token || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  let b = '';
  for (const x of new Uint8Array(digest)) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function currentUser(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const tokenHash = await hashToken(authorization.slice(7).trim());
  return env.DB.prepare(
    `SELECT u.id,u.name,u.username,u.status,p.name AS profile
       FROM sessions s
       JOIN users u ON u.id=s.user_id
       JOIN profiles p ON p.id=u.profile_id
      WHERE s.token_hash=?1
        AND s.revoked_at IS NULL
        AND s.expires_at>CURRENT_TIMESTAMP
        AND u.status='active'
      LIMIT 1`
  ).bind(tokenHash).first();
}

async function adminReset(request, env) {
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: 'Não autenticado.' }, 401);
  if (!['Gestão', 'Coordenador', 'Desenvolvedor'].includes(actor.profile)) {
    return json({ error: 'Seu perfil não pode redefinir senhas de colaboradores.' }, 403);
  }

  const body = await request.json().catch(() => null);
  const targetId = Number(body?.user_id);
  const passwordHash = String(body?.password_hash || '');
  if (!targetId || !isValidPasswordHash(passwordHash)) {
    return json({ error: 'Dados de redefinição inválidos.' }, 400);
  }

  const target = await env.DB.prepare(
    `SELECT u.id,u.name,u.username,u.status,p.name AS profile
       FROM users u
       JOIN profiles p ON p.id=u.profile_id
      WHERE u.id=?1
      LIMIT 1`
  ).bind(targetId).first();
  if (!target) return json({ error: 'Colaborador não encontrado.' }, 404);
  if (target.status !== 'active') return json({ error: 'Somente colaboradores ativos podem receber nova senha.' }, 409);
  if (Number(target.id) === Number(actor.id)) return json({ error: 'Use a alteração de senha da própria conta para redefinir sua senha.' }, 409);

  if (actor.profile === 'Coordenador') {
    if (!['Analista', 'Assistente'].includes(target.profile)) {
      return json({ error: 'O coordenador só pode redefinir a senha de analistas e assistentes.' }, 403);
    }
    const link = await env.DB.prepare(
      `SELECT 1 FROM team_members
        WHERE user_id=?1 AND coordinator_user_id=?2
        LIMIT 1`
    ).bind(target.id, actor.id).first();
    if (!link) return json({ error: 'Este colaborador não pertence à sua equipe.' }, 403);
  }

  if (actor.profile === 'Gestão' && target.profile === 'Desenvolvedor') {
    return json({ error: 'Gestão não pode redefinir a senha de um desenvolvedor.' }, 403);
  }

  await env.DB.prepare('UPDATE users SET password_hash=?1 WHERE id=?2')
    .bind(passwordHash, target.id).run();

  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(target.id).run();

  try {
    await env.DB.prepare(
      `INSERT INTO history(user_id,entity_type,entity_id,action,description)
       VALUES(?1,'user',?2,'PASSWORD_RESET',?3)`
    ).bind(
      actor.id,
      target.id,
      `Senha redefinida por ${actor.name} (${actor.profile}) para ${target.name} (${target.profile}).`
    ).run();
  } catch (historyError) {
    console.warn('Password reset: history could not be recorded.', historyError);
  }

  return json({ ok: true, username: target.username, sessions_revoked: true });
}

export async function handlePasswordReset(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/auth/reset-password' || request.method !== 'POST') return null;

  try {
    const configuredSecret = String(env.BOOTSTRAP_SECRET || '');
    const suppliedSecret = request.headers.get('X-Bootstrap-Secret') || '';

    // Fluxo administrativo autenticado: Gestão, Coordenador e Desenvolvedor.
    // Mantém o fluxo de bootstrap existente para recuperação técnica.
    if (!suppliedSecret) return await adminReset(request, env);

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
