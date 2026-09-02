(function(){
  const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
  const STATES=['PE','AL','PB','SP'];
  let cache=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v?String(v).slice(0,10):'';
  const isManager=()=>['Gestão','Desenvolvedor'].includes(state.user?.profile);
  async function load(){const r=await api('/api/deadline-configs');cache=r.data||[];return r}
  function dateFor(t,s){return fmt(cache.find(x=>x.obligation===t&&x.state===s)?.due_date)}
  function render(c,r){
    const manager=isManager();
    const stores=state.data?.stores||[];
    const visibleStates=manager?STATES:[...new Set((r?.states||stores.map(x=>String(x.state||'').toUpperCase())).filter(s=>STATES.includes(s)))].sort();
    if(!visibleStates.length){c.innerHTML='<div class="section-title"><div><h2>Prazos</h2><p class="muted">Nenhum prazo disponível para os estados das suas lojas.</p></div></div><div class="card empty">Nenhum registro encontrado.</div>';return}
    const head=visibleStates.map(s=>`<th>${s}</th>`).join('');
    const rows=TAXES.map(t=>`<tr><td><b>${t}</b></td>${visibleStates.map(s=>`<td>${manager?`<input class="deadline-input" type="date" data-tax="${t}" data-state="${s}" value="${esc(dateFor(t,s))}">`:`<span class="deadline-date">${dateFor(t,s)?new Date(dateFor(t,s)+'T00:00:00').toLocaleDateString('pt-BR'):'Não informado'}</span>`}</td>`).join('')}</tr>`).join('');
    c.innerHTML=`<div class="section-title"><div><h2>Prazos</h2><p class="muted">${manager?'Preencha os prazos de ICMS, PIS/Cofins, ISS, SPED e Fronteiras para PE, AL, PB e SP.':'Consulte os prazos dos estados das suas lojas.'}</p></div>${manager?'<button class="primary" id="save-deadlines">Salvar prazos</button>':''}</div><div class="card"><div class="table-wrap"><table class="deadline-table"><thead><tr><th>Imposto / Obrigação</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></div><div class="card deadline-note"><b>Regra:</b> Gestão e Desenvolvedor administram os 4 estados. Analistas visualizam somente os estados das lojas da própria carteira.</div>`;
    if(manager)document.querySelector('#save-deadlines').onclick=save;
  }
  async function save(){
    const btn=document.querySelector('#save-deadlines');btn.disabled=true;btn.textContent='Salvando...';
    try{const items=[...document.querySelectorAll('.deadline-input')].map(i=>({obligation:i.dataset.tax,state:i.dataset.state,due_date:i.value}));await api('/api/deadline-configs',{method:'PUT',body:JSON.stringify({items})});await load();render(document.querySelector('#content'),{states:STATES});alert('Prazos salvos com sucesso.')}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Salvar prazos'}
  }
  window.prazos=async function(c){try{const r=await load();render(c,r)}catch(e){c.innerHTML=`<div class="error">${esc(e.message)}</div>`}};
  const style=document.createElement('style');style.textContent='.deadline-table th,.deadline-table td{vertical-align:middle}.deadline-input{width:100%;min-width:130px;padding:9px;border:1px solid #dfe5ef;border-radius:8px;background:#fff;font:inherit}.deadline-date{font-weight:600}.deadline-note{margin-top:12px;font-size:13px;color:#6b7280}';document.head.appendChild(style);
})();
