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
          <div class="field"><label for="username">Usuário</label><input id="username" autocomplete="username" required></div>
          <div class="field"><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required></div>
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
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Fiscal Control</div>
        <nav class="nav">
          <button data-page="dashboard">Dashboard</button>
          <button data-page="team">Equipe</button>
          <button data-page="stores">Lojas</button>
          <button data-page="portfolios">Carteiras</button>
          ${['Gestão','Desenvolvedor'].includes(state.user.profile) ? '<button data-page="management">Gestão</button>' : ''}
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
  document.querySelector('[data-page="dashboard"]')?.classList.add('active');
  document.querySelector('#logout').addEventListener('click', () => {
    sessionStorage.removeItem('fiscal_token');
    state.token = null;
    state.user = null;
    renderLogin();
  });
}

function cards(items) {
  return `<div class="grid">${items.map(([label, value]) => `<article class="card kpi"><div class="label">${label}</div><div class="value">${value ?? 0}</div></article>`).join('')}</div>`;
}

function table(columns, rows) {
  if (!rows.length) return '<div class="card empty">Nenhum registro encontrado.</div>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${row[c[0]] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
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
      content.innerHTML = '<div class="section"><h2>Lista completa da equipe</h2>' + table([
        ['name','Colaborador'], ['profile','Perfil'], ['seniority','Senioridade'], ['portfolio_count','Carteiras']
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
      const { data } = await api('/api/management/analysts');
      content.innerHTML = '<div class="section"><h2>Acompanhamento dos analistas</h2>' + table([
        ['name','Analista'], ['seniority','Senioridade'], ['portfolio_count','Carteiras'], ['obligation_count','Obrigações'], ['pending_count','Pendências'], ['overdue_count','Em atraso']
      ], data) + '</div>';
    }
  } catch (error) {
    if (error.message === 'Não autenticado.') {
      sessionStorage.removeItem('fiscal_token');
      state.token = null;
      state.user = null;
      renderLogin('Sua sessão expirou.');
      return;
    }
    content.innerHTML = `<div class="error">${error.message}</div>`;
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
