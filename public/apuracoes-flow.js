(()=>{
  const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
  const ANALYST_PROFILES=['Analista','Assistente'];
  let active=false;
  let busy=false;
  let data=null;
  let interval=null;

  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const seconds=(n)=>Math.max(0,Math.floor(Number(n)||0));
  const fmt=(n)=>{
    const s=seconds(n),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return h?`${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`:`${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
  };
  const diff=(a,b)=>a?Math.max(0,(new Date(b||Date.now())-new Date(a))/1000):0;
  const isAnalyst=()=>ANALYST_PROFILES.includes(state.user?.profile);
  const onPage=()=>document.querySelector('#page-title')?.textContent.trim()==='Apurações';
  const getItem=(storeId,tax)=>data?.items?.find(x=>Number(x.store_id)===Number(storeId)&&x.obligation===tax)||{store_id:storeId,obligation:tax,status:'Pendente'};

  function timerText(x){
    if(x.status==='Gerando') return `Tempo de geração: ${fmt(diff(x.started_at))}`;
    if(x.status==='Query geradas') return `Geração concluída: ${fmt(diff(x.started_at,x.query_generated_at))}`;
    if(x.status==='Analisando') return `Tempo de análise: ${fmt(diff(x.analyzing_at))}`;
    if(x.status==='Finalizado') return `Tempo de análise: ${fmt(diff(x.analyzing_at,x.finished_at))}`;
    return '';
  }

  function statusLabel(status){
    return ({Pendente:'Pendente',Gerando:'Gerando query','Query geradas':'Query gerada',Analisando:'Analisando',Finalizado:'Finalizado'})[status]||status;
  }

  function action(x){
    if(x.status==='Pendente') return `<button class="badge blue fc-ap-action" data-id="${x.store_id}" data-tax="${esc(x.obligation)}" data-next="Gerando">Gerar</button>`;
    if(x.status==='Gerando') return `<button class="badge blue fc-ap-action" data-id="${x.store_id}" data-tax="${esc(x.obligation)}" data-next="Query geradas">Query gerada</button>`;
    if(x.status==='Query geradas') return `<button class="badge blue fc-ap-action" data-id="${x.store_id}" data-tax="${esc(x.obligation)}" data-next="Analisando">Analisando</button>`;
    if(x.status==='Analisando') return `<button class="badge green fc-ap-action" data-id="${x.store_id}" data-tax="${esc(x.obligation)}" data-next="Finalizado">Finalizado</button>`;
    return '<span class="badge green">Finalizado</span>';
  }

  function render(c,d){
    if(!isAnalyst()) return;
    data=d;
    const stores=d?.stores||[];
    c.innerHTML=`<div class="fc-ap-grid">${stores.map(s=>`<article class="card fc-ap-card">
      <div class="ap-store-head"><div><b>${esc(s.number)} · ${esc(s.name)}</b><small>${esc(s.state||'')}</small></div><button class="primary small fc-icms-check" data-store="${s.id}">Checklist ICMS</button></div>
      ${TAXES.map(t=>{const x=getItem(s.id,t);const showTimer=x.status!=='Pendente';return `<div class="ap-row fc-ap-row">
        <div><b>${t}</b><small>Status: ${statusLabel(x.status)}</small>${showTimer?`<small class="fc-ap-timer" data-id="${s.id}" data-tax="${esc(t)}">${timerText(x)}</small>`:''}</div>
        ${action(x)}
      </div>`}).join('')}
    </article>`).join('')}</div>`;
    bind(c);
    refreshTimers(c);
  }

  function refreshTimers(c){
    if(!data) return;
    c.querySelectorAll('.fc-ap-timer').forEach(node=>{
      const x=getItem(node.dataset.id,node.dataset.tax);
      node.textContent=timerText(x);
    });
  }

  function bind(c){
    c.querySelectorAll('.fc-ap-action').forEach(btn=>btn.onclick=async()=>{
      if(busy) return;
      busy=true; btn.disabled=true;
      try{
        const result=await api('/api/apuracoes/status',{method:'PUT',body:JSON.stringify({store_id:Number(btn.dataset.id),obligation:btn.dataset.tax,status:btn.dataset.next})});
        if(!result?.ok) throw new Error('Não foi possível atualizar a etapa.');
        const fresh=await api('/api/apuracoes');
        render(c,fresh);
      }catch(e){
        alert(e.message||'Erro ao atualizar a apuração.');
        btn.disabled=false;
      }finally{busy=false}
    });

    c.querySelectorAll('.fc-icms-check').forEach(btn=>btn.onclick=async()=>{
      const id=Number(btn.dataset.store);
      const original=window.__apuracoesOriginalCheck;
      if(typeof original==='function'){original(id);return;}
      try{
        const d=await api('/api/icms-checklist');
        const s=(data?.stores||[]).find(x=>Number(x.id)===id);
        const map=new Map((d.data||[]).filter(x=>Number(x.store_id)===id).map(x=>[x.item_key,x.status]));
        const labels={quebra_sequencia:'1. Quebra de sequência',painel_inconsistencia:'2. Painel de inconsistência',notas_baixa_estoque:'3. Notas de baixa de estoque',curva_abc:'4. Curva ABC',ajustes_credito_debito:'5. Ajustes de crédito e débito',contabilizacao:'6. Contabilização'};
        const opts=k=>k==='quebra_sequencia'?'<button data-v="feito">Feito 💚</button><button data-v="ha_quebras">Há quebras 🟡</button>':k==='curva_abc'?'<button data-v="feito">Feito 💚</button><button data-v="incons_comercial">Incons. Comercial 🟡</button><button data-v="incons_contabil">Incons. Contábil 🟡</button>':'<button data-v="feito">Feito 💚</button>';
        c.innerHTML=`<div class="card checklist"><div class="section-title"><div><h2>Checklist ICMS</h2><p class="muted">${esc(s?.number||'')} · ${esc(s?.name||'')}</p></div><button id="fc-back-ap">Voltar</button></div>${Object.entries(labels).map(([k,l])=>`<div class="check-row"><div><b>${l}</b><small>${map.get(k)?'Concluído':'Pendente'}</small></div><div class="check-options" data-item="${k}">${opts(k)}</div></div>`).join('')}</div>`;
        c.querySelectorAll('.check-options button').forEach(x=>x.onclick=async()=>{const w=x.parentElement;try{await api('/api/icms-checklist',{method:'PUT',body:JSON.stringify({store_id:id,item_key:w.dataset.item,status:x.dataset.v})});w.querySelectorAll('button').forEach(y=>y.classList.remove('selected'));x.classList.add('selected');w.previousElementSibling.querySelector('small').textContent='Concluído'}catch(e){alert(e.message)}});
        c.querySelector('#fc-back-ap').onclick=()=>api('/api/apuracoes').then(z=>render(c,z));
      }catch(e){alert(e.message||'Não foi possível abrir o checklist.')}
    });
  }

  async function activate(){
    if(!onPage()||!isAnalyst()) return;
    const c=document.querySelector('#content');
    if(!c) return;
    if(active&&c.querySelector('.fc-ap-grid')) return;
    active=true;
    try{render(c,await api('/api/apuracoes'));}catch(e){active=false;console.error(e)}
  }

  function stopTimer(){if(interval){clearInterval(interval);interval=null}}
  interval=setInterval(()=>{if(onPage()&&isAnalyst()&&data){const c=document.querySelector('#content');if(c?.querySelector('.fc-ap-grid'))refreshTimers(c)}},1000);

  new MutationObserver(()=>{
    if(!onPage()){active=false;stopTimer();return}
    if(isAnalyst()){
      const c=document.querySelector('#content');
      if(c&&!c.querySelector('.fc-ap-grid')&&!c.querySelector('.checklist'))setTimeout(activate,60);
    }
  }).observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-page="apuracoes"]')){active=false;setTimeout(activate,120)}
  });

  const style=document.createElement('style');
  style.textContent=`
    .fc-ap-grid{display:grid;gap:14px}
    .fc-ap-card .fc-ap-row{min-height:54px}
    .fc-ap-action{position:relative;z-index:30;pointer-events:auto!important;touch-action:manipulation;cursor:pointer;white-space:nowrap}
    .fc-ap-action:disabled{pointer-events:none!important;opacity:.65}
    .fc-ap-timer{font-variant-numeric:tabular-nums;font-weight:600}
  `;
  document.head.appendChild(style);
  setTimeout(activate,350);
})();
