const app = document.querySelector('#app');

const state = {
  token: sessionStorage.getItem('fiscal_token'),
  user: null,
  page: 'dashboard'
};

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login">
      <section class="login-card">
        <div class="brand">Fiscal Control</div>
        <p class="subtitle">Gestão Fiscal Mensal</p>
        ${message ? `<div class="error">${message}</div>` : ''}
        <form id="login-form">
          <div class="field"><label for="username">Usuário</label><input id="username" name="username" autocomplete="username" required></div>
          <div class="field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
          <button class="primary" type="submit">Entrar</button>
        </form>
      </section>
    </main>`;
  document.querySelector('#login-form').addEventListener('submit', login);
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    state.token = result.token;
    state.user = result.user;
    sessionStorage.setItem('fiscal_token', state.token);
    renderShell();
    await loadPage();
  } catch (error) {
    renderLogin(error.message);
  }
}

function renderShell() {
  const management = ['Gestão', 'Desenvolvedor'].includes(state.user.profile);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Fiscal Control</div>
        <nav class="nav">
          <button data-page="dashboard">Dashboard</button>
          <button data-page="team">Equipe</button>
          <button data-page="stores">Lojas</button>
          <button data-page="portfolios">Carteiras</button>
          ${management ? '<button data-page="management">Gestão</button>' : ''}
        </nav>
        <div style="margin-top:auto"><button id="logout" style="width:100%;background:#263454;color:#fff">Sair</button></div>
      </aside>
      <main class="main">
        <header class="topbar"><h1 id="page-title">Dashboard</h1><div class="user-chip">${state.user.name} · ${state.user.profile}</div></header>
        <section id="content"></section>
      </main>
    </div>`;

  document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', async () => {
    state.page = btn.dataset.page;
    document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b === btn));
    await loadPage();
  }));
  document.querySelector(`[data-page="${state.page}"]`)?.classList.add('active');
  document.querySelector('#logout').addEventListener('click', async () => {
    try { if (state.token) await api('/api/auth/logout', { method: 'POST' }); } catch {}
    sessionStorage.removeItem('fiscal_token');
    state.token = null;
    state.user = null;
    state.page = 'dashboard';
    renderLogin();
  });
}

function cards(items) {
  return `<div class="grid">${items.map(([label, value]) => `<article class="card kpi"><div class="label">${label}</div><div class="value">${value ?? 0}</div></article>`).join('')}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function table(columns, rows) {
  if (!rows.length) return '<div class="card empty">Nenhum registro encontrado.</div>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(row[c[0]] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function collaboratorForm(options) {
  const coordinatorOptions = options.coordinators.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
  const managerOptions = options.managers.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
  return `
    <div class="card form-card">
      <div class="form-header"><div><h2>Novo colaborador</h2><p class="muted">Cadastre o acesso e a posição do colaborador na hierarquia.</p></div></div>
      <form id="collaborator-form" class="form-grid">
        <div class="field"><label for="new-name">Nome</label><input id="new-name" required></div>
        <div class="field"><label for="new-username">Usuário</label><input id="new-username" autocomplete="off" required></div>
        <div class="field"><label for="new-password">Senha inicial</label><input id="new-password" type="password" minlength="12" autocomplete="new-password" required><small>Mínimo de 12 caracteres.</small></div>
        <div class="field"><label for="new-profile">Perfil</label><select id="new-profile" required><option value="">Selecione</option><option>Assistente</option><option>Analista</option><option>Coordenador</option></select></div>
        <div class="field" id="seniority-field"><label for="new-seniority">Senioridade</label><select id="new-seniority"><option value="">Selecione</option><option value="junior">Júnior</option><option value="pleno">Pleno</option><option value="senior">Sênior</option></select></div>
        <div class="field" id="coordinator-field"><label for="new-coordinator">Coordenador responsável</label><select id="new-coordinator"><option value="">Selecione</option>${coordinatorOptions}</select></div>
        <div class="field"><label for="new-manager">Gerente responsável</label><select id="new-manager" required>${managerOptions}</select></div>
        <div class="form-actions"><button type="button" id="cancel-new">Cancelar</button><button class="primary form-submit" type="submit">Cadastrar colaborador</button></div>
      </form>
    </div>`;
}

function bindCollaboratorForm() {
  const form = document.querySelector('#collaborator-form');
  const profile = document.querySelector('#new-profile');
  const seniorityField = document.querySelector('#seniority-field');
  const coordinatorField = document.querySelector('#coordinator-field');
  const coordinator = document.querySelector('#new-coordinator');

  function updateFields() {
    const isCoordinator = profile.value === 'Coordenador';
    seniorityField.style.display = isCoordinator ? 'none' : 'grid';
    coordinatorField.style.display = isCoordinator ? 'none' : 'grid';
    coordinator.required = !isCoordinator;
  }
  profile.addEventListener('change', updateFields);
  updateFields();
  document.querySelector('#cancel-new').addEventListener('click', () => loadPage());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('.form-submit');
    button.disabled = true;
    button.textContent = 'Cadastrando...';
    try {
      await api('/api/team/create', {
        method: 'POST',
        body: JSON.stringify({
          name: document.querySelector('#new-name').value.trim(),
          username: document.querySelector('#new-username').value.trim(),
          password: document.querySelector('#new-password').value,
          profile: profile.value,
          seniority: document.querySelector('#new-seniority').value || null,
          coordinator_user_id: coordinator.value || null,
          manager_user_id: document.querySelector('#new-manager').value || null
        })
      });
      state.page = 'management';
      await loadPage();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = 'Cadastrar colaborador';
    }
  });
}

async function loadPage() {
  const content = document.querySelector('#content');
  const title = document.querySelector('#page-title');
  if (!content) return;
  const titles = { dashboard:'Dashboard', team:'Equipe', stores:'Lojas', portfolios:'Carteiras', management:'Gestão' };
  title.textContent = titles[state.page] || 'Fiscal Control';
  content.innerHTML = '<div class="card">Carregando...</div>';

  try {
    if (state.page === 'dashboard') {
      const { data } = await api('/api/dashboard');
      content.innerHTML = `${cards([
        ['Analistas ativos', data.activeAnalysts], ['Lojas ativas', data.activeStores], ['Obrigações', data.obligations], ['Pendências', data.pending], ['Em atraso', data.overdue]
      ])}<div class="section"><h2>Visão geral</h2><div class="card">Centralização dos indicadores e acompanhamento da operação fiscal.</div></div>`;
    }

    if (state.page === 'team') {
      const { data } = await api('/api/team');
      content.innerHTML = '<div class="section"><h2>Equipe</h2><p class="muted">Colaboradores autorizados para o seu nível de acesso.</p>' + table([
        ['name','Colaborador'], ['profile','Perfil'], ['seniority','Senioridade'], ['coordinator_name','Coordenador'], ['manager_name','Gerente'], ['portfolio_count','Carteiras']
      ], data) + '</div>';
    }

    if (state.page === 'stores') {
      const { data } = await api('/api/stores');
      content.innerHTML = '<div class="section"><h2>Lojas</h2>' + table([
        ['code','Código'], ['name','Nome'], ['document','Documento'], ['status','Status']
      ], data) + '</div>';
    }

    if (state.page === 'portfolios') {
      const { data } = await api('/api/portfolios');
      content.innerHTML = '<div class="section"><h2>Carteiras</h2>' + table([
        ['name','Carteira'], ['description','Descrição']
      ], data) + '</div>';
    }

    if (state.page === 'management') {
      const [{ data }, options] = await Promise.all([api('/api/management/analysts'), api('/api/team/options')]);
      content.innerHTML = `
        <div class="section">
          <div class="section-header"><div><h2>Gestão da equipe</h2><p class="muted">Acompanhamento dos analistas e administração dos acessos.</p></div><button class="primary action-button" id="new-collaborator">+ Novo colaborador</button></div>
          ${table([
            ['name','Colaborador'], ['seniority','Senioridade'], ['coordinator_name','Coordenador'], ['manager_name','Gerente'], ['portfolio_count','Carteiras'], ['obligation_count','Obrigações'], ['pending_count','Pendências'], ['overdue_count','Em atraso']
          ], data)}
        </div>`;
      document.querySelector('#new-collaborator').addEventListener('click', () => {
        content.innerHTML = collaboratorForm(options);
        bindCollaboratorForm();
      });
    }
  } catch (error) {
    if (error.message === 'Não autenticado.') {
      sessionStorage.removeItem('fiscal_token');
      state.token = null;
      state.user = null;
      renderLogin('Sua sessão expirou.');
      return;
    }
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function start() {
  if (!state.token) return renderLogin();
  try {
    const result = await api('/api/auth/me');
    state.user = result.user;
    renderShell();
    await loadPage();
  } catch {
    sessionStorage.removeItem('fiscal_token');
    state.token = null;
    renderLogin();
  }
}

start();
