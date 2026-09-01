const app = document.querySelector('#app');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function installAccessSetup() {
  const form = document.querySelector('#login-form');
  if (!form || document.querySelector('#access-setup-toggle')) return;

  const toggle = document.createElement('button');
  toggle.id = 'access-setup-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Configurar acesso inicial';
  toggle.style.cssText = 'display:block;width:100%;margin-top:12px;border:0;background:transparent;color:#1d3b7a;font-weight:600;cursor:pointer;padding:8px;';

  const panel = document.createElement('div');
  panel.id = 'access-setup-panel';
  panel.style.cssText = 'display:none;margin-top:14px;padding:16px;border:1px solid #d8deea;border-radius:10px;background:#f7f9fc;';
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Configuração de acesso</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:12px">Use somente para primeiro acesso ou recuperação administrativa.</div>
    <div class="field"><label for="setup-username">Usuário</label><input id="setup-username" value="wemerson" autocomplete="username"></div>
    <div class="field"><label for="setup-secret">Código administrativo</label><input id="setup-secret" type="password" autocomplete="off"></div>
    <div class="field"><label for="setup-password">Nova senha</label><input id="setup-password" type="password" minlength="12" autocomplete="new-password"><small>Mínimo de 12 caracteres.</small></div>
    <div class="field"><label for="setup-password-confirm">Confirmar senha</label><input id="setup-password-confirm" type="password" minlength="12" autocomplete="new-password"></div>
    <div id="setup-message" style="display:none;margin:10px 0;padding:10px;border-radius:8px;font-size:13px"></div>
    <button id="setup-submit" class="primary" type="button" style="width:100%">Salvar nova senha</button>`;

  form.insertAdjacentElement('afterend', toggle);
  toggle.insertAdjacentElement('afterend', panel);

  toggle.addEventListener('click', () => {
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    toggle.textContent = open ? 'Fechar configuração de acesso' : 'Configurar acesso inicial';
  });

  panel.querySelector('#setup-submit').addEventListener('click', async () => {
    const username = panel.querySelector('#setup-username').value.trim().toLowerCase();
    const secret = panel.querySelector('#setup-secret').value;
    const password = panel.querySelector('#setup-password').value;
    const confirm = panel.querySelector('#setup-password-confirm').value;
    const message = panel.querySelector('#setup-message');
    const button = panel.querySelector('#setup-submit');

    message.style.display = 'none';
    if (!username || !secret || password.length < 12) {
      message.textContent = 'Preencha usuário, código administrativo e uma senha de pelo menos 12 caracteres.';
      message.style.display = 'block';
      return;
    }
    if (password !== confirm) {
      message.textContent = 'As senhas não conferem.';
      message.style.display = 'block';
      return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Bootstrap-Secret': secret
        },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      message.textContent = 'Senha configurada com sucesso. Agora feche esta área e entre com o usuário e a nova senha.';
      message.style.display = 'block';
      message.style.background = '#ecfdf5';
      message.style.color = '#166534';
      panel.querySelector('#setup-password')?.focus();
    } catch (error) {
      message.textContent = escapeHtml(error.message);
      message.style.display = 'block';
      message.style.background = '#fef2f2';
      message.style.color = '#991b1b';
    } finally {
      button.disabled = false;
      button.textContent = 'Salvar nova senha';
    }
  });
}

if (app) {
  const observer = new MutationObserver(installAccessSetup);
  observer.observe(app, { childList: true, subtree: true });
  installAccessSetup();
}
