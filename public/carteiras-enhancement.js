(() => {
  const STYLE_ID = 'carteiras-enhancement-style';
  const BAR_ID = 'carteiras-tools';

  function esc(v) {
    return String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID}{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:0 0 16px}
      #${BAR_ID} .filter-field{display:flex;flex-direction:column;gap:6px;min-width:180px}
      #${BAR_ID} label{font-size:12px;font-weight:700;color:#536176}
      #${BAR_ID} select,#${BAR_ID} button{height:38px;border:1px solid #d9e0ea;border-radius:9px;background:#fff;padding:0 12px;font:inherit;color:#17243a}
      #${BAR_ID} button{cursor:pointer;font-weight:700}
      #${BAR_ID} .print-btn{background:#17243a;color:#fff;border-color:#17243a}
      #${BAR_ID} .clear-btn{background:#f5f7fa}
      @media print{
        body.print-carteiras *{visibility:hidden!important}
        body.print-carteiras .main,body.print-carteiras .main *{visibility:visible!important}
        body.print-carteiras .sidebar,body.print-carteiras #${BAR_ID},body.print-carteiras .user-chip{display:none!important}
        body.print-carteiras .main{margin:0!important;padding:20px!important;width:100%!important}
        body.print-carteiras table{width:100%!important}
      }
    `;
    document.head.appendChild(style);
  }

  function isCarteiras() {
    return document.querySelector('#page-title')?.textContent.trim() === 'Carteiras';
  }

  function getTableInfo() {
    const table = document.querySelector('#content table');
    if (!table) return null;
    const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim().toLowerCase());
    const stateIndex = headers.indexOf('estado');
    const analystIndex = headers.indexOf('analista');
    return { table, stateIndex, analystIndex };
  }

  function getRows() {
    return [...document.querySelectorAll('#content table tbody tr')];
  }

  function readCell(row, index) {
    return index >= 0 ? row.querySelectorAll('td')[index]?.textContent.trim() || '' : '';
  }

  function refreshOptions(bar) {
    const stateSelect = bar.querySelector('#carteiras-state-filter');
    const analystSelect = bar.querySelector('#carteiras-analyst-filter');
    const info = getTableInfo();
    if (!stateSelect || !analystSelect || !info) return;
    const currentState = stateSelect.value;
    const currentAnalyst = analystSelect.value;
    const states = new Set();
    const analysts = new Set();
    getRows().forEach(row => {
      const s = readCell(row, info.stateIndex);
      const a = readCell(row, info.analystIndex);
      if (s && s !== '—') states.add(s);
      if (a && a !== '—') analysts.add(a);
    });
    stateSelect.innerHTML = '<option value="">Todos os estados</option>';
    analystSelect.innerHTML = '<option value="">Todos os analistas</option>';
    [...states].sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(v => stateSelect.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
    [...analysts].sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(v => analystSelect.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
    stateSelect.value = [...stateSelect.options].some(o=>o.value===currentState) ? currentState : '';
    analystSelect.value = [...analystSelect.options].some(o=>o.value===currentAnalyst) ? currentAnalyst : '';
  }

  function applyFilters() {
    const bar = document.getElementById(BAR_ID);
    const info = getTableInfo();
    if (!bar || !info) return;
    const state = bar.querySelector('#carteiras-state-filter')?.value || '';
    const analyst = bar.querySelector('#carteiras-analyst-filter')?.value || '';
    getRows().forEach(row => {
      const rowState = readCell(row, info.stateIndex);
      const rowAnalyst = readCell(row, info.analystIndex);
      row.style.display = (!state || rowState === state) && (!analyst || rowAnalyst === analyst) ? '' : 'none';
    });
  }

  function setup() {
    if (!isCarteiras()) return;
    const content = document.querySelector('#content');
    const info = getTableInfo();
    if (!content || !info) return;
    installStyle();
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.innerHTML = `
        <div class="filter-field"><label for="carteiras-state-filter">Estado</label><select id="carteiras-state-filter"><option value="">Todos os estados</option></select></div>
        <div class="filter-field"><label for="carteiras-analyst-filter">Analista</label><select id="carteiras-analyst-filter"><option value="">Todos os analistas</option></select></div>
        <button type="button" class="clear-btn" id="carteiras-clear-filter">Limpar filtros</button>
        <button type="button" class="print-btn" id="carteiras-print-screen">Imprimir tela</button>
        <button type="button" class="print-btn" id="carteiras-print-list">Imprimir lista</button>`;
      content.insertBefore(bar, info.table.parentElement || info.table);
      bar.querySelector('#carteiras-state-filter').onchange = applyFilters;
      bar.querySelector('#carteiras-analyst-filter').onchange = applyFilters;
      bar.querySelector('#carteiras-clear-filter').onclick = () => {
        bar.querySelector('#carteiras-state-filter').value='';
        bar.querySelector('#carteiras-analyst-filter').value='';
        applyFilters();
      };
      const print = (listOnly) => {
        document.body.classList.add('print-carteiras');
        const old = document.title;
        if (listOnly) document.title = 'Fiscal Control - Carteiras';
        window.print();
        document.title = old;
        setTimeout(() => document.body.classList.remove('print-carteiras'), 500);
      };
      bar.querySelector('#carteiras-print-screen').onclick = () => print(false);
      bar.querySelector('#carteiras-print-list').onclick = () => print(true);
    }
    refreshOptions(bar);
    applyFilters();
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; setup(); }, 80);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('load', schedule);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-page="carteiras"]')) schedule();
  });
  schedule();
})();
