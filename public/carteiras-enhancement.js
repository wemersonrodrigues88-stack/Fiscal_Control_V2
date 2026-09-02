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
    const title = document.querySelector('#page-title');
    return title && title.textContent.trim() === 'Carteiras';
  }

  function getRows() {
    return [...document.querySelectorAll('#content table tbody tr')];
  }

  function setup() {
    if (!isCarteiras()) return;
    installStyle();
    const content = document.querySelector('#content');
    const table = content?.querySelector('table');
    if (!content || !table) return;

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
      content.insertBefore(bar, table.parentElement || table);

      const stateSelect = bar.querySelector('#carteiras-state-filter');
      const analystSelect = bar.querySelector('#carteiras-analyst-filter');
      const states = new Set();
      const analysts = new Set();
      getRows().forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[2]) states.add(cells[2].textContent.trim());
        if (cells[4]) analysts.add(cells[4].textContent.trim());
      });
      [...states].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(v => stateSelect.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));
      [...analysts].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(v => analystSelect.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`));

      const apply = () => {
        const state = stateSelect.value;
        const analyst = analystSelect.value;
        getRows().forEach(row => {
          const cells = row.querySelectorAll('td');
          const rowState = cells[2]?.textContent.trim() || '';
          const rowAnalyst = cells[4]?.textContent.trim() || '';
          row.style.display = (!state || rowState === state) && (!analyst || rowAnalyst === analyst) ? '' : 'none';
        });
      };
      stateSelect.onchange = apply;
      analystSelect.onchange = apply;
      bar.querySelector('#carteiras-clear-filter').onclick = () => { stateSelect.value=''; analystSelect.value=''; apply(); };
      bar.querySelector('#carteiras-print-screen').onclick = () => {
        document.body.classList.add('print-carteiras');
        window.print();
        setTimeout(() => document.body.classList.remove('print-carteiras'), 500);
      };
      bar.querySelector('#carteiras-print-list').onclick = () => {
        document.body.classList.add('print-carteiras');
        const old = document.title;
        document.title = 'Fiscal Control - Carteiras';
        window.print();
        document.title = old;
        setTimeout(() => document.body.classList.remove('print-carteiras'), 500);
      };
    }
  }

  const observer = new MutationObserver(() => setTimeout(setup, 0));
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('load', setup);
})();
