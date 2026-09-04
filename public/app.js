/* Fiscal Control — Checklist ICMS v8 publicado: 8 itens. */
const app = document.querySelector('#app');
const PASSWORD_ITERATIONS = 120000;
const TAX = ['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const state = { token: sessionStorage.getItem('fiscal_token'), user: null, page: 'dashboard', data: null };
function b64url(bytes){let b='';for(const x of bytes)b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function fromB64url(s){const n=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(n),c=>c.charCodeAt(0))}
async function derive(password,salt,iterations){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256);return new Uint8Array(bits)}
async function signProof(derived,challenge){const key=await crypto.subtle.importKey('raw',derived,{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(challenge))))}
async function api(path,opt={}){const headers={...(opt.headers||{})};if(state.token)headers.Authorization=`Bearer ${state.token}`;if(opt.body&&!headers['content-type'])headers['content-type']='application/json';const r=await fetch(path,{...opt,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data}
function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function renderLogin(message=''){app.innerHTML=`<main class="login"><section class="login-card"><div class="brand">Fiscal Control</div><p class="subtitle">Gestão Fiscal Mensal</p>${message?`<div class="error">${esc(message)}</div>`:''}<form id="login-form"><div class="field"><label for="username">Usuário</label><input id="username" autocomplete="username" required></div><div class="field"><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required></div><button class="primary" type="submit">Entrar</button></form></section></main>`;document.querySelector('#login-form').addEventListener('submit',login)}
async function login(e){e.preventDefault();const username=document.querySelector('#username').value.trim().toLowerCase();const password=document.querySelector('#password').value;const button=e.currentTarget.querySelector('button');button.disabled=true;button.textContent='Entrando...';try{const c=await fetch('/api/auth/challenge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username})});const cd=await c.json().catch(()=>({}));if(!c.ok)throw new Error(cd.error||'Usuário ou senha inválidos.');const derived=await derive(password,fromB64url(cd.salt),Number(cd.iterations)||PASSWORD_ITERATIONS);const proof=await signProof(derived,cd.challenge);const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username,challenge:cd.challenge,proof})});state.token=result.token;state.user=result.user;sessionStorage.setItem('fiscal_token',state.token);state.page='dashboard';await start()}catch(err){renderLogin(err.message)}finally{button.disabled=false;button.textContent='Entrar'}}
function renderShell(){const management=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile);const historyAccess=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile);if(!historyAccess&&state.page==='historico')state.page='dashboard';app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand">Fiscal Control</div><nav class="nav"><button data-page="dashboard">Dashboard</button><button data-page="apuracoes">Apurações</button><button data-page="carteiras">Carteiras</button><button data-page="prazos">Prazos</button>${historyAccess?'<button data-page="historico">Histórico</button>':''}<button data-page="equipe">Equipe</button>${management?'<button data-page="management">Gestão</button>':''}</nav><div class="logout-wrap"><button id="logout">Sair</button></div></aside><main class="main"><header class="topbar"><h1 id="page-title">Dashboard</h1><div class="user-chip">${esc(state.user.name)} · ${esc(state.user.profile)}</div></header><section id="content"></section></main></div>`;document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',async()=>{state.page=b.dataset.page;document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));await loadPage()}));document.querySelector(`[data-page="${state.page}"]`)?.classList.add('active');document.querySelector('#logout').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST'})}catch{}sessionStorage.removeItem('fiscal_token');state.token=null;state.user=null;renderLogin()}}
function cards(items){return `<div class="grid kpis">${items.map(([l,v])=>`<article class="card kpi"><div class="label">${l}</div><div class="value">${v??0}</div></article>`).join('')}</div>`}
function stores(){return state.data?.stores||[]} function analysts(){return state.data?.analysts||[]} function executions(){return state.data?.executions||[]}
function assigned(name){return stores().filter(s=>s.analyst===name)}
function ex(store,tax){return executions().find(x=>String(x.store_id)===String(store.id)&&x.obligation===tax)?.status||'Pendente'}
function pct(arr){const total=arr.length*TAX.length;if(!total)return 0;return Math.round(arr.reduce((n,s)=>n+TAX.filter(t=>ex(s,t)==='Finalizado').length,0)/total*100)}
function table(columns,rows,empty='Nenhum registro encontrado.'){if(!rows.length)return `<div class="card empty">${empty}</div>`;return `<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c[0]]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
async function loadPage(){const c=document.querySelector('#content');const title=document.querySelector('#page-title');const titles={dashboard:'Dashboard',apuracoes:'Apurações',carteiras:'Carteiras',prazos:'Prazos',historico:'Histórico',equipe:'Equipe',management:'Gestão'};if(state.page==='historico'&&!['Gestão','Desenvolvedor','Coordenador'].includes(state.user?.profile)){state.page='dashboard';}title.textContent=titles[state.page]||'Fiscal Control';title.style.display=state.page==='apuracoes'?'none':'';/* O Dashboard não exibe a tela transitória "Carregando..."; o conteúdo é renderizado assim que /api/state responder. */if(state.page!=='dashboard')c.innerHTML='<div class="card">Carregando...</div>';try{if(state.page==='apuracoes')return apuracoes(c);state.data=await api('/api/state');if(state.page==='dashboard')return dashboard(c);if(state.page==='carteiras')return carteiras(c);if(state.page==='prazos')return prazos(c);if(state.page==='historico')return historico(c);if(state.page==='equipe')return equipe(c);return managementPage(c)}catch(err){if(err.message==='Não autenticado.'){sessionStorage.removeItem('fiscal_token');state.token=null;state.user=null;renderLogin('Sua sessão expirou.');return}c.innerHTML=`<div class="error">${esc(err.message)}</div>`}}
function historico(c){
  const s=stores(), exs=executions(), hist=state.data?.history||[], deadlines=state.data?.deadlines||[], taxCfg=state.data?.tax_deadlines||[];
  const period=new Date().toISOString().slice(0,7);
  const dateBR=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')};
  const dayFor=(store,tax,month=period)=>{
    if(tax==='ISS'){
      const x=store.iss_due_day;return x?Number(x):null;
    }
    const x=taxCfg.find(z=>String(z.state).toUpperCase()===String(store.state).toUpperCase()&&z.tax_name===tax);
    return x?.due_day?Number(x.due_day):null;
  };
  const dueDate=(store,tax,month=period)=>{
    const d=dayFor(store,tax,month);if(!d)return null;
    const [y,m]=month.split('-').map(Number);return new Date(y,m-1,d,23,59,59);
  };
  const rows=[];
  for(const store of s){
    for(const tax of TAX){
      const e=exs.find(x=>String(x.store_id)===String(store.id)&&x.obligation===tax);
      const done=e?.status==='Finalizado'&&e.updated_at;
      const due=dueDate(store,tax);
      let result=e?.status==='Finalizado'?'No prazo':(e?.status==='Analisando'?'Em andamento':'Pendente');
      let delay=0;
      if(done&&due){delay=Math.floor((new Date(done)-due)/86400000);result=delay>0?'Atrasado '+delay+' dia'+(delay===1?'':'s'):delay<0?'Antecipado '+Math.abs(delay)+' dia'+(Math.abs(delay)===1?'':'s'):'No prazo'}
      rows.push({store:store.name,tax,analyst:store.analyst||'—',due:due?dateBR(due):'—',delivery:done?dateBR(done):'—',result,delay});
    }
  }
  const delayedHistory={};
  hist.forEach(h=>{
    if(h.entity_type!=='execution')return;
    let d;try{d=JSON.parse(h.description||'{}')}catch{return}
    if(d.status!=='Finalizado')return;
    const store=s.find(x=>String(x.id)===String(h.entity_id));if(!store)return;
    const month=String(h.created_at||'').slice(0,7);if(!month)return;
    const due=dueDate(store,d.obligation,month);
    if(due&&new Date(h.created_at)>due){
      const key=store.id+'|'+d.obligation;
      (delayedHistory[key]??=[]).push(month);
    }
  });
  const currentDelayed=rows.filter(r=>r.delay>0);
  const recurrence=currentDelayed.map(r=>{
    const store=s.find(x=>x.name===r.store);const key=store?.id+'|'+r.tax;
    const months=[...(delayedHistory[key]||[])];
    if(r.delay>0&&!months.includes(period))months.push(period);
    return {...r,lateMonths:[...new Set(months)].sort().length};
  });
  const stats=[
    ['Entregas no prazo',rows.filter(r=>r.result==='No prazo'||r.result.startsWith('Antecipado')).length],
    ['Atrasos',rows.filter(r=>r.delay>0).length],
    ['Recorrências de atraso',recurrence.filter(r=>r.lateMonths>=2).length]
  ];
  const attention=recurrence.filter(r=>r.delay>0||r.lateMonths>=2);
  c.innerHTML='<div class="section-title"><div><h2>Histórico</h2><p class="muted">Fechamento do período, pontualidade, atrasos e recorrências.</p></div></div>'+
    cards(stats)+
    '<div class="card section"><div class="title"><h3>Precisa de atenção</h3><span class="badge '+(attention.length?'red':'blue')+'">'+attention.length+'</span></div>'+
    (attention.length?'<div class="table-wrap"><table><thead><tr><th>Loja</th><th>Obrigação</th><th>Analista</th><th>Vencimento</th><th>Entrega</th><th>Situação</th><th>Recorrência</th></tr></thead><tbody>'+
      attention.map(r=>'<tr><td>'+esc(r.store)+'</td><td>'+esc(r.tax)+'</td><td>'+esc(r.analyst)+'</td><td>'+esc(r.due)+'</td><td>'+esc(r.delivery)+'</td><td>'+esc(r.result)+'</td><td>'+(r.lateMonths>=2?'2º mês ou mais com atraso':'1º atraso')+'</td></tr>').join('')+
      '</tbody></table></div>':'<div class="empty">Nenhuma ocorrência exige atenção neste período.</div>')+
    '</div>'+
    '<div class="card section"><div class="title"><h3>Fechamento do mês</h3><span class="badge blue">'+period+'</span></div>'+
    '<div class="table-wrap"><table><thead><tr><th>Loja</th><th>Obrigação</th><th>Analista</th><th>Vencimento</th><th>Entrega</th><th>Resultado</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td>'+esc(r.store)+'</td><td>'+esc(r.tax)+'</td><td>'+esc(r.analyst)+'</td><td>'+esc(r.due)+'</td><td>'+esc(r.delivery)+'</td><td>'+esc(r.result)+'</td></tr>').join('')+
    '</tbody></table></div></div>';
}

function dashboard(c){const s=stores(),done=executions().filter(x=>x.status==='Finalizado').length,running=executions().filter(x=>x.status==='Analisando').length,pending=Math.max(0,s.length*TAX.length-done-running);c.innerHTML=`<div class="section-title"><div><h2>Controle Fiscal</h2><p class="muted">Acompanhamento online e centralizado da operação fiscal.</p></div></div>${cards([['Analistas ativos',analysts().length],['Lojas ativas',s.length],['Finalizadas',done],['Em andamento',running],['Pendentes',pending]])}<div class="grid two section"><div class="card"><div class="title"><h3>Obrigações</h3><span class="badge blue">Online</span></div>${TAX.map(t=>{const n=s.filter(x=>ex(x,t)==='Finalizado').length;return `<div class="metric"><span>${t}</span><b>${n}/${s.length}</b></div><div class="progress"><i style="width:${s.length?n/s.length*100:0}%"></i></div>`}).join('')}</div><div class="card"><div class="title"><h3>Analistas</h3></div>${analysts().map(a=>`<div class="metric"><span>${esc(a.name)}</span><b>${pct(assigned(a.name))}%</b></div>`).join('')}</div></div>`}
function apuracoes(c){
const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const CHECK={quebra_sequencia:'1. Quebra de sequência',painel_inconsistencia:'2. Painel de inconsistência',notas_baixa_estoque:'3. Notas de baixa de estoque',curva_abc:'4. Curva ABC',ajustes_credito_debito:'5. Ajustes de crédito e débito',registro_resumo_icms:'6. Registro e Resumo do ICMS e outros documentos salvos na pasta (REDE)',controle_fechado:'7. Controle Fechado',contabilizacao:'8. Contabilização'};
const CONTROL=['Gestão','Gerente','Coordenador','Desenvolvedor'];
const isControl=()=>CONTROL.includes(state.user?.profile);
const secs=n=>{n=Math.floor(Number(n)||0);const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h}h ${m}m ${s}s`:`${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`};
const elapsed=(a,b)=>a?Math.max(0,(new Date(b||Date.now())-new Date(a))/1000):0;
const cls=s=>s==='Finalizado'?'green':s==='Analisando'?'blue':s==='Gerando Query'?'yellow':s==='Query geradas'?'gray':'gray';const flowLabel=x=>x.flow_phase==='Gerando'?'Gerando Query':x.flow_phase==='Query'?'Query geradas':x.flow_phase==='Analisando'?'Analisando':x.flow_phase==='Finalizado'?'Finalizada':x.status||'Pendente';const action=x=>{const id=x.store_id||x.id,tax=esc(x.obligation),phase=x.flow_phase||'Pendente';if(phase==='Pendente')return '<button class="ap-flow-button pending" data-id="'+id+'" data-tax="'+tax+'" data-next="Gerando">Pendente</button>';if(phase==='Gerando')return '<button class="ap-flow-button running" data-id="'+id+'" data-tax="'+tax+'" data-next="Query">Gerando Query <span class="flow-live-dot">●</span></button>';if(phase==='Query')return '<button class="ap-flow-button ready" data-id="'+id+'" data-tax="'+tax+'" data-next="Analisando">Query geradas</button>';if(phase==='Analisando')return '<button class="ap-flow-button analyzing" data-id="'+id+'" data-tax="'+tax+'" data-next="Finalizado">Analisando</button>';return '<span class="badge green">Finalizada</span>';};const canAdjustTime=()=>['Gerente','Coordenador','Desenvolvedor'].includes(state.user?.profile);const rollbackButton=x=>!isControl()||x.status==='Pendente'?'':`<button class="ap-correct" data-id="${x.store_id||x.id}" data-tax="${esc(x.obligation)}" data-status="${esc(x.status)}" title="Corrigir status">↩ Corrigir</button>${x.status==='Finalizado'&&canAdjustTime()?`<button class="ap-adjust-time" data-id="${x.store_id||x.id}" data-tax="${esc(x.obligation)}" data-finished="${esc(x.finished_at||'')}" title="Ajustar horário real de conclusão">⏱ Ajustar horário</button>`:''}`;
const adjustTime=async b=>{const current=b.dataset.finished?new Date(b.dataset.finished).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'';const value=prompt('Informe a data e hora reais de conclusão (DD/MM/AAAA HH:MM).',current);if(value===null)return;const m=value.trim().match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})[ ]+([0-9]{2}):([0-9]{2})$/);if(!m){alert('Formato inválido. Use DD/MM/AAAA HH:MM.');return}const iso=m[3]+'-'+m[2]+'-'+m[1]+'T'+m[4]+':'+m[5]+':00-03:00';const t=new Date(iso);if(Number.isNaN(t.getTime())){alert('Data ou hora inválida.');return}if(t>new Date()){alert('O horário de conclusão não pode ser futuro.');return}b.disabled=true;try{await api('/api/apuracoes/adjust-finished-at',{method:'PUT',body:JSON.stringify({store_id:Number(b.dataset.id),obligation:b.dataset.tax,finished_at:t.toISOString()})});render(b.closest('#content'),await load())}catch(e){alert(e.message);b.disabled=false}};
const bind=c=>{c.querySelectorAll('.ap-flow-button').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/apuracoes/status',{method:'PUT',body:JSON.stringify({store_id:Number(b.dataset.id),obligation:b.dataset.tax,status:b.dataset.next})});render(c,await load())}catch(e){alert(e.message);b.disabled=false}});c.querySelectorAll('.icms-check').forEach(b=>b.onclick=()=>check(c,Number(b.dataset.store)));c.querySelectorAll('.ap-adjust-time').forEach(b=>b.onclick=()=>adjustTime(b));c.querySelectorAll('.store-status-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();const menu=b.parentElement.querySelector('.store-status-menu');c.querySelectorAll('.store-status-menu.open').forEach(x=>{if(x!==menu)x.classList.remove('open')});menu?.classList.toggle('open')});c.querySelectorAll('.icms-debtor-status-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();const menu=b.parentElement.querySelector('.icms-debtor-menu');c.querySelectorAll('.icms-debtor-menu.open').forEach(x=>{if(x!==menu)x.classList.remove('open')});menu?.classList.toggle('open')});c.querySelectorAll('.icms-debtor-choice').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=Number(b.dataset.id),action=b.dataset.action;if(action==='request'){b.disabled=true;try{await api('/api/icms-debtor',{method:'PUT',body:JSON.stringify({store_id:id,action:'request'})});render(c,await load())}catch(err){alert(err.message);b.disabled=false}}else if(action==='approve'||action==='finalize_debtor'||action==='invalid_request'){await decideDebtor(c,id,action)}else b.parentElement.classList.remove('open')});c.addEventListener('click',e=>{if(!e.target.closest('.store-name-control')&&!e.target.closest('.manager-store-status')){c.querySelectorAll('.store-status-menu.open,.icms-debtor-menu.open').forEach(x=>x.classList.remove('open'))}});};
const debtorStatus=(s,d)=>d.items.find(i=>i.store_id===s.id&&i.obligation==='ICMS')?.icms_debtor_status||null;
const analystStoreControl=(s,d)=>{const st=debtorStatus(s,d);return '<div class="store-name-control"><button type="button" class="store-status-trigger" data-id="'+s.id+'"><b>'+esc(s.number)+' · '+esc(s.name)+'</b><small>'+esc(s.state||'')+'</small></button><div class="store-status-menu"><div class="store-status-title">Situação do ICMS</div><button type="button" class="store-status-option" data-id="'+s.id+'" data-action="noop">'+(st==='aguardando_transferencia'?'🟡 Loja devedora — aguardando transferência de crédito':st==='transferencia_aprovada'?'🟢 Transferência de crédito aprovada':st==='finalizada_devedora'?'🟢 Finalizar como devedora':st==='solicitacao_indev'?'Normal':'Normal')+'</button>'+(st==='aguardando_transferencia'?'':'<button type="button" class="store-status-option debtor-option" data-id="'+s.id+'" data-action="request">Loja devedora — solicitar transferência de crédito</button>')+'</div></div>'};
const managerStoreControl=(s,d)=>{const st=debtorStatus(s,d);const pending=st==='aguardando_transferencia';const status=st==='transferencia_aprovada'?'Transferência aprovada':st==='finalizada_devedora'?'Finalizar como devedora':st==='solicitacao_indev'?'Solicitação indevida':'';return '<div class="manager-store-status"><div class="store-name-static"><b>'+esc(s.number)+' · '+esc(s.name)+'</b><small>'+esc(s.state||'')+'</small></div>'+(pending?'<button type="button" class="icms-debtor-status-trigger" data-id="'+s.id+'">Loja devedora, aguardando transferência de crédito</button><div class="icms-debtor-menu"><div class="icms-debtor-menu-title">Situação da solicitação</div><button type="button" class="icms-debtor-choice" data-id="'+s.id+'" data-action="approve">Transferência aprovada</button><button type="button" class="icms-debtor-choice" data-id="'+s.id+'" data-action="finalize_debtor">Finalizar como devedora</button><button type="button" class="icms-debtor-choice" data-id="'+s.id+'" data-action="invalid_request">Solicitação indevida</button></div>':status?'<div class="icms-debtor-resolved">'+status+'</div>':'')+'</div>'};
async function decideDebtor(c,id,action){try{await api('/api/icms-debtor',{method:'PUT',body:JSON.stringify({store_id:id,action})});render(c,await load())}catch(e){alert(e.message)}}
const analyst=(c,d)=>{c.innerHTML=`<style>.store-name-control{position:relative;display:inline-block}.store-status-trigger{border:0!important;background:transparent!important;padding:0!important;text-align:left;cursor:pointer;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:flex-start}.store-status-trigger b{font-size:16px}.store-status-trigger small{font-size:12px;color:#64748b;margin-top:3px}.store-status-trigger:hover b{text-decoration:underline}.store-status-menu{display:none;position:absolute;left:0;top:calc(100% + 7px);z-index:1200;min-width:300px;background:#fff;border:1px solid #dbe3ef;border-radius:10px;padding:8px;box-shadow:0 12px 30px rgba(15,23,42,.16)}.store-status-menu.open{display:flex;flex-direction:column;gap:3px}.store-status-title{font-size:12px;font-weight:700;color:#667085;padding:5px 8px}.store-status-option{border:0!important;background:#fff!important;text-align:left;padding:9px 8px;border-radius:7px;cursor:pointer;font:inherit;color:#0f172a}.store-status-option:hover{background:#f1f5f9!important}.debtor-option{font-weight:600}.store-status-current{font-size:13px;color:#344054;padding:8px;border-radius:7px;background:#f8fafc}</style><div class="section-title"><div><p class="muted">Somente as lojas da sua carteira.</p></div></div><div class="ap-grid">${d.stores.map(s=>`<article class="card"><div class="ap-store-head">${analystStoreControl(s,d)}<button class="primary small icms-check" data-store="${s.id}">Checklist ICMS</button></div>${TAXES.map(t=>{const x=d.items.find(i=>i.store_id===s.id&&i.obligation===t)||{store_id:s.id,obligation:t,status:'Pendente'};return `<div class="ap-row"><div><b>${t}</b><small>Status: ${x.status}</small></div>${action(x)}</div>`}).join('')}</article>`).join('')}</div>`;bind(c)};
const filter=(c,d)=>{const a=c.querySelector('#ap-analyst').value,s=c.querySelector('#ap-store').value,st=c.querySelector('#ap-state').value;[...c.querySelectorAll('.ap-table tbody tr')].forEach(r=>r.style.display=(!a||r.dataset.a===a)&&(!s||r.dataset.s===s)&&(!st||r.dataset.st===st)?'':'none');const rows=d.stores.filter(x=>(!a||x.analyst===a)&&(!s||String(x.id)===s)&&(!st||x.state===st));c.querySelector('#ap-individual').innerHTML=rows.length?rows.map(x=>`<div class="individual"><b>${esc(x.number)} · ${esc(x.name)} — ${esc(x.analyst||'Sem carteira')}</b><div>${d.items.filter(i=>i.store_id===x.id).map(i=>`<span class="badge ${cls(i.status)}">${i.obligation}: ${i.status}${i.status==='Finalizado'?` · ${secs(elapsed(i.started_at,i.finished_at))}`:''}</span>`).join(' ')}</div></div>`).join(''):'Nenhum registro.'};
const manager=(c,d)=>{const as=[...new Set(d.stores.map(s=>s.analyst).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),states=[...new Set(d.stores.map(s=>s.state).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));c.innerHTML=`<div class="section-title"><div><h2>Apurações — Acompanhamento</h2><p class="muted">Visão geral individual, relatórios e correção de status.</p></div><div class="ap-toolbar"><button class="secondary" id="ap-refresh">Atualizar</button><button class="primary" id="ap-report-partial">Relatório</button><button class="primary" id="abc-report">Curva ABC</button></div></div><style>.store-name-control{position:relative;display:inline-block}.store-status-trigger{border:0;background:transparent;padding:0;text-align:left;cursor:pointer;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:flex-start}.store-status-trigger:hover b{text-decoration:underline}.store-status-menu{display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:1200;min-width:310px;background:#fff;border:1px solid #dbe3ef;border-radius:10px;padding:8px;box-shadow:0 12px 30px rgba(15,23,42,.18)}.store-status-menu.open{display:flex;flex-direction:column;gap:4px}.store-status-title{font-size:12px;font-weight:700;color:#667085;padding:5px 8px}.store-status-current{font-size:13px;color:#344054;padding:8px;border-radius:7px;background:#f8fafc}.store-status-option{border:0;background:#fff;text-align:left;padding:9px 8px;border-radius:7px;cursor:pointer;font:inherit;color:#0f172a}.store-status-option:hover{background:#f1f5f9}.debtor-option{font-weight:600} .manager-store-status{display:flex;flex-direction:column;align-items:flex-start;gap:5px}.store-name-static{display:flex;flex-direction:column;align-items:flex-start}.icms-debtor-actions{display:flex;flex-direction:column;align-items:flex-start;gap:2px}.icms-debtor-actions .store-status-option{font-size:12px;font-weight:600;padding:3px 0;color:#344054}.icms-debtor-actions .store-status-option:hover{text-decoration:underline;background:transparent}.icms-debtor-resolved{font-size:12px;font-weight:600;color:#667085}.icms-debtor-status-trigger{border:0;background:transparent;padding:3px 0;margin:1px 0 0;text-align:left;cursor:pointer;color:#b7791f;font-size:12px;font-weight:600;line-height:1.35}.icms-debtor-status-trigger:hover{text-decoration:underline;color:#9a670f}.icms-debtor-menu{display:none;position:absolute;left:0;top:calc(100% + 5px);z-index:1300;min-width:255px;background:#fff;border:1px solid #dbe3ef;border-radius:9px;padding:6px;box-shadow:0 10px 24px rgba(15,23,42,.14)}.manager-store-status{position:relative}.icms-debtor-menu.open{display:flex;flex-direction:column;gap:2px}.icms-debtor-menu-title{font-size:11px;font-weight:700;color:#667085;padding:6px 8px 5px}.icms-debtor-choice{border:0;background:#fff;text-align:left;padding:8px;border-radius:6px;cursor:pointer;font-size:13px;color:#172033}.icms-debtor-choice:hover{background:#f5f7fa}.ap-flow-button{border:0;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;background:#eef2f7;color:#334155}.ap-flow-button.running{background:#fff4d6;color:#9a670f}.ap-flow-button.ready{background:#eef2f7;color:#475569}.ap-flow-button.analyzing{background:#e8f0ff;color:#2457a6}.ap-flow-button.pending{background:#e8f0ff;color:#2457a6}.flow-live-dot{font-size:9px;margin-left:3px}.ap-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ap-row>div:last-child{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.ap-report-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:1000;background:#fff;border:1px solid #dbe3ef;border-radius:10px;padding:8px;box-shadow:0 12px 30px rgba(15,23,42,.18);min-width:220px}.ap-report-menu select{width:100%;min-height:42px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;background:#fff;color:#0f172a;font-size:14px;cursor:pointer}</style><div class="ap-filters"><select id="ap-analyst"><option value="">Todos os analistas</option>${as.map(a=>`<option>${esc(a)}</option>`).join('')}</select><select id="ap-store"><option value="">Todas as lojas</option>${d.stores.map(s=>`<option value="${s.id}">${esc(s.number)} · ${esc(s.name)}</option>`).join('')}</select><select id="ap-state"><option value="">Todos os estados</option>${states.map(st=>`<option>${esc(st)}</option>`).join('')}</select></div><div class="card"><div class="table-wrap"><table class="ap-table"><thead><tr><th>Loja</th><th>Analista</th>${TAXES.map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${d.stores.map(s=>`<tr data-a="${esc(s.analyst||'')}" data-s="${s.id}" data-st="${esc(s.state||'')}"><td>${managerStoreControl(s,d)}</td><td>${esc(s.analyst||'Sem carteira')}</td>${TAXES.map(t=>{const x=d.items.find(i=>i.store_id===s.id&&i.obligation===t)||{store_id:s.id,obligation:t,status:'Pendente'};return `<td><span class="badge ${cls(x.status)}">${x.status}</span>${x.flow_phase==='Gerando'?`<small class="timer" data-t-start="${esc(x.started_at||'')}" data-t-query="${esc(x.query_generated_at||'')}">${secs(elapsed(x.started_at,x.query_generated_at||null))}</small>`:''}${x.flow_phase==='Analisando'?`<small class="timer" data-t="${esc(x.flow_analyzing_at||x.analyzing_at||'')}">${secs(elapsed(x.flow_analyzing_at||x.analyzing_at))}</small>`:''}${x.flow_phase==='Finalizado'||x.status==='Finalizado'?`<small class="timer">Total ${secs(elapsed(x.started_at,x.query_generated_at))+elapsed(x.flow_analyzing_at||x.analyzing_at,x.finished_at)}</small>`:''}`).join('\n')}`,'1');const n=Number(choice);if(!options[n-1])return;const target=options[n-1];if(!confirm(`Voltar ${tax} de ${current} para ${target}?`))return;try{await api('/api/apuracoes/rollback',{method:'PUT',body:JSON.stringify({store_id:Number(id),obligation:tax,status:target})});render(c,await load())}catch(e){alert(e.message)}}
async function check(c,id){const d=await api('/api/icms-checklist'),s=(state.data?.stores||[]).find(x=>Number(x.id)===id),map=new Map((d.data||[]).filter(x=>x.store_id===id).map(x=>[x.item_key,x.status]));const opt=k=>k==='quebra_sequencia'?'<button data-v="feito">Sem diferença 💚</button><button data-v="ha_quebras">Há diferença 🟡</button>':k==='curva_abc'?'<button data-v="feito">Sem diferença</button><button data-v="incons_comercial">Diferença Comercial</button><button data-v="incons_contabil">Diferença Contábil</button>':'<button data-v="feito">Feito 💚</button>';c.innerHTML=`<div class="card checklist"><div class="section-title"><div><h2>Checklist ICMS</h2><p class="muted">${esc(s?.number||'')} · ${esc(s?.name||'')}</p></div><button id="back-ap">Voltar</button></div>${Object.entries(CHECK).map(([k,l])=>`<div class="check-row"><div><b>${l}</b><small>${map.get(k)?'Concluído':'Pendente'}</small></div><div class="check-options" data-item="${k}">${opt(k)}</div></div>`).join('')}</div>`;c.querySelectorAll('.check-options button').forEach(b=>b.onclick=async()=>{const w=b.parentElement;try{await api('/api/icms-checklist',{method:'PUT',body:JSON.stringify({store_id:id,item_key:w.dataset.item,status:b.dataset.v})});w.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');w.previousElementSibling.querySelector('small').textContent='Concluído'}catch(e){alert(e.message)}});c.querySelector('#back-ap').onclick=()=>load().then(d=>render(c,d))}
function openReportSelector(){const old=document.getElementById('ap-report-menu');if(old){old.remove();return}const btn=document.getElementById('ap-report-partial');if(!btn)return;const wrap=document.createElement('div');wrap.id='ap-report-menu';wrap.className='ap-report-menu';wrap.innerHTML=`<select aria-label="Selecione o imposto para gerar o relatório"><option value="">Selecione o imposto</option>${TAXES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>`;btn.parentElement.style.position='relative';btn.parentElement.appendChild(wrap);const select=wrap.querySelector('select');select.focus();select.onchange=()=>{if(select.value){wrap.remove();printReport(select.value)}};document.addEventListener('click',function close(e){if(!wrap.contains(e.target)&&e.target!==btn){wrap.remove();document.removeEventListener('click',close)}})}
async function printReport(obligation){try{const r=await api('/api/apuracoes-report'),d=r.data||{},rows=(d.finalized||[]).filter(x=>x.obligation===obligation),title=`Relatório — ${obligation} — Lojas Finalizadas`;const summary=(d.summary||[]).map(x=>`<tr><td>${esc(x.obligation)}</td><td>${x.finalized}</td><td>${x.pending}</td><td>${x.total_stores}</td></tr>`).join('');const tableRows=rows.map(x=>`<tr><td>${esc(x.number)} · ${esc(x.name)}</td><td>${esc(x.state)}</td><td>${esc(x.analyst||'Sem carteira')}</td><td>${esc(x.obligation)}</td><td><b>${esc(x.status)}</b></td><td>${x.status==='Finalizado'&&x.finished_at?new Date(x.finished_at).toLocaleString('pt-BR'):x.status==='Analisando'&&x.analyzing_at?new Date(x.analyzing_at).toLocaleString('pt-BR'):x.status==='Gerando'&&x.started_at?new Date(x.started_at).toLocaleString('pt-BR'):'—'}</td></tr>`).join('');const w=window.open('','_blank');if(!w){alert('Permita pop-ups para imprimir o relatório.');return}w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#1f2937}h1{margin:0 0 6px}p{color:#667085}.meta{margin:18px 0;padding:12px;background:#f6f7f9;border-radius:8px}table{border-collapse:collapse;width:100%;margin-top:14px}th,td{border:1px solid #d9dee7;padding:8px;font-size:12px;text-align:left}th{background:#f2f4f7}h2{margin-top:26px;font-size:16px}@media print{button{display:none}}</style></head><body><h1>${title}</h1><p>Competência: ${esc(d.competence_period||'')}</p><div class="meta">Gerado em ${new Date(d.generated_at||Date.now()).toLocaleString('pt-BR')} · Imposto selecionado: <b>${esc(obligation)}</b> · Mostrando somente lojas com status Finalizado.</div><h2>Lojas finalizadas — ${esc(obligation)}</h2><table><thead><tr><th>Loja</th><th>UF</th><th>Analista</th><th>Imposto / obrigação</th><th>Status</th><th>Última movimentação</th></tr></thead><tbody>${tableRows||`<tr><td colspan="6">Nenhuma loja finalizada para este imposto.</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);w.document.close()}catch(e){alert(e.message)}}
async function abc(){try{const r=await api('/api/curva-abc-report'),w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>Relatório Curva ABC - Fiscal Control</title><style>body{font-family:Arial;padding:28px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f2f4f7}</style></head><body><h1>Relatório Curva ABC</h1><p>Situação por loja para a equipe de Contabilidade.</p><table><tr><th>Loja</th><th>Estado</th><th>Analista</th><th>Situação Curva ABC</th></tr>${(r.data||[]).map(x=>`<tr><td>${esc(x.number)} · ${esc(x.name)}</td><td>${esc(x.state)}</td><td>${esc(x.analyst)}</td><td>${esc(x.curva_abc)}</td></tr>`).join('')}</table><script>window.onload=()=>window.print()</script></body></html>`);w.document.close()}catch(e){alert(e.message)}}
function render(c,d){isControl()?manager(c,d):analyst(c,d)}

load().then(d=>render(c,d)).catch(e=>{c.innerHTML=`<div class="error">${esc(e.message)}</div>`});
}
function carteiras(c){
  const all=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile)?stores():assigned(state.user.name);
  const canEdit=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile);
  const states=[...new Set(all.map(x=>String(x.state||'').trim()).filter(Boolean))].sort();
  const names=[...new Set(all.map(x=>String(x.analyst||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const cols=[['number','Número'],['name','Loja'],['state','Estado'],['document','CNPJ'],['analyst','Analista'],['state_registration','Inscrição Estadual'],['municipal_registration','Inscrição Municipal']];
  if(canEdit)cols.push(['_edit','Ação']);
  const opt=v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>';
  if(!document.getElementById('stores-row-hover-style')){
    const st=document.createElement('style');
    st.id='stores-row-hover-style';
    st.textContent='.stores-table-row-hover tbody tr{transition:background-color .12s ease}.stores-table-row-hover tbody tr:hover,.stores-table-row-hover tbody tr:hover td{background:#eef4ff}';
    document.head.appendChild(st);
  }
  c.innerHTML='<div class="section-title" style="justify-content:flex-end;margin-bottom:16px"><div style="display:flex;gap:10px;align-items:center">'+(canEdit?'<button class="primary" id="new-store">+ Nova loja</button>':'')+'</div></div>'+
    '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap"><div class="field" style="width:220px"><label>Estado</label><select id="filter-state"><option value="">Todos os estados</option>'+states.map(opt).join('')+'</select></div><div class="field" style="width:220px"><label>Analista</label><select id="filter-analyst"><option value="">Todos os analistas</option>'+names.map(opt).join('')+'</select></div></div></div><div id="stores-table"></div>';
  const render=()=>{const fs=c.querySelector('#filter-state').value,fa=c.querySelector('#filter-analyst').value;const rows=all.filter(r=>(!fs||String(r.state||'')===fs)&&(!fa||String(r.analyst||'')===fa));const body=rows.map(r=>'<tr>'+cols.map(x=>x[0]==='_edit'?'<td><button class="badge blue edit-store" data-id="'+r.id+'">Editar</button></td>':'<td>'+(x[0]==='name'&&canEdit?'<button type="button" class="store-name-click" data-id="'+r.id+'" style="background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-align:left;cursor:pointer">'+esc(r.name)+'</button>':esc(r[x[0]]||'—'))+'</td>').join('')+'</tr>').join('');c.querySelector('#stores-table').innerHTML=rows.length?'<div class="table-wrap"><table class="stores-table-row-hover"><thead><tr>'+cols.map(x=>'<th>'+x[1]+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>':'<div class="card empty">Nenhuma loja encontrada para os filtros selecionados.</div>';c.querySelectorAll('.edit-store,.store-name-click').forEach(b=>b.onclick=()=>openStoreEditor(c,all.find(x=>String(x.id)===b.dataset.id)));};
  ['#filter-state','#filter-analyst'].forEach(s=>c.querySelector(s).addEventListener('change',render));
  c.querySelector('#new-store')?.addEventListener('click',()=>openStoreEditor(c,null));
  render();
}
async function openStoreEditor(c,store){
  const filterState=c.querySelector('#filter-state')?.value||'';
  const filterAnalyst=c.querySelector('#filter-analyst')?.value||'';
  let analystsList=analysts();
  if(!analystsList.length){const options=await api('/api/team');analystsList=(options.data||[]).filter(x=>x.profile==='Analista');}
  const analystOptions=analystsList.map(a=>'<option value="'+a.id+'" '+(a.name===store?.analyst?'selected':'')+'>'+esc(a.name)+'</option>').join('');
  const isNew=!store, title=isNew?'Cadastrar nova loja':'Editar loja', submitText=isNew?'Cadastrar loja':'Salvar alterações';
  const legacyStreet=store?.street||store?.address||'';
  c.innerHTML='<div class="card form-card store-editor"><div class="form-header"><div><h2>'+title+'</h2><p class="muted">'+(isNew?'Cadastre os dados da loja e, se desejar, já vincule o analista responsável.':'Altere os dados cadastrais. Os dados atuais foram carregados e serão preservados no formulário.')+'</p></div></div><form id="store-form" class="form-grid">'+
    '<div class="field"><label>Número da loja</label><input id="store-number" value="'+esc(store?.number||'')+'" required></div>'+
    '<div class="field"><label>Nome da loja</label><input id="store-name" value="'+esc(store?.name||'')+'" required></div>'+
    '<div class="field"><label>CNPJ</label><input id="store-document" value="'+esc(store?.document||'')+'"></div>'+
    '<div class="field"><label>Inscrição Estadual</label><input id="store-ie" value="'+esc(store?.state_registration||'')+'"></div>'+
    '<div class="field"><label>Inscrição Municipal</label><input id="store-im" value="'+esc(store?.municipal_registration||'')+'"></div>'+
    '<div class="field"><label>Rua</label><input id="store-street" value="'+esc(legacyStreet)+'"></div>'+
    '<div class="field"><label>Número</label><input id="store-address-number" value="'+esc(store?.address_number||'')+'"></div>'+
    '<div class="field"><label>Complemento</label><input id="store-complement" value="'+esc(store?.complement||'')+'"></div>'+
    '<div class="field"><label>Bairro</label><input id="store-neighborhood" value="'+esc(store?.neighborhood||'')+'"></div>'+
    '<div class="field"><label>Cidade</label><input id="store-city" value="'+esc(store?.city||'')+'"></div>'+
    '<div class="field"><label>Estado</label><input id="store-state" value="'+esc(store?.state||'')+'" maxlength="2" placeholder="PE"></div>'+
    '<div class="field"><label>Vencimento do ISS (dia)</label><input id="store-iss-due-day" type="number" min="1" max="31" step="1" value="'+esc(store?.iss_due_day??'')+'" placeholder="Ex.: 10"></div>'+
    '<div class="field"><label>Analista</label><select id="store-analyst"><option value="">Sem analista</option>'+analystOptions+'</select></div>'+
    '<div class="form-actions"><button type="button" id="cancel-store">Cancelar</button><button class="primary form-submit" type="submit">'+submitText+'</button></div></form></div>';
  document.querySelector('#cancel-store').onclick=loadPage;
  document.querySelector('#store-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=e.currentTarget.querySelector('.form-submit');btn.disabled=true;btn.textContent='Salvando...';
    const street=document.querySelector('#store-street').value.trim(), addressNumber=document.querySelector('#store-address-number').value.trim(), complement=document.querySelector('#store-complement').value.trim(), neighborhood=document.querySelector('#store-neighborhood').value.trim(), city=document.querySelector('#store-city').value.trim(), uf=document.querySelector('#store-state').value.trim().toUpperCase(), dueRaw=document.querySelector('#store-iss-due-day').value.trim();
    const parts=[street,addressNumber?('nº '+addressNumber):'',complement,neighborhood,city,uf].filter(Boolean);
    const address=parts.length?parts.join(', '):(store?.address||'');
    const issDueDay=dueRaw===''?null:Number(dueRaw);
    if(issDueDay!==null&&(!Number.isInteger(issDueDay)||issDueDay<1||issDueDay>31)){alert('O vencimento do ISS deve ser um dia entre 1 e 31.');btn.disabled=false;btn.textContent=submitText;return}
    try{
      const payload={number:document.querySelector('#store-number').value.trim(),name:document.querySelector('#store-name').value.trim(),document:document.querySelector('#store-document').value.trim(),state:uf,address,street,address_number:addressNumber,complement,neighborhood,city,state_registration:document.querySelector('#store-ie').value.trim(),municipal_registration:document.querySelector('#store-im').value.trim(),iss_due_day:issDueDay,analyst_id:document.querySelector('#store-analyst').value||null};
      const saved=await api(isNew?'/api/stores':'/api/stores/'+store.id,{method:isNew?'POST':'PUT',body:JSON.stringify(payload)});const savedStore=saved?.data;if(!savedStore)throw new Error('A loja foi salva, mas o sistema não recebeu os dados da loja.');state.data=state.data||{};const list=Array.isArray(state.data.stores)?state.data.stores.slice():[];const idx=list.findIndex(x=>String(x.id)===String(savedStore.id));if(idx>=0)list[idx]={...list[idx],...savedStore};else list.push(savedStore);state.data.stores=list;state.page='carteiras';carteiras(c);const restoredState=c.querySelector('#filter-state'),restoredAnalyst=c.querySelector('#filter-analyst');if(restoredState)restoredState.value=filterState;if(restoredAnalyst)restoredAnalyst.value=filterAnalyst;if(restoredState)restoredState.dispatchEvent(new Event('change'));
    }catch(err){alert(err.message);btn.disabled=false;btn.textContent=submitText}
  };
}
async function prazos(c){
  const canEdit=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile);
  const restricted=['Analista','Assistente'].includes(state.user.profile);
  const configs=state.data?.tax_deadlines||[];
  const iss=state.data?.iss_deadlines||[];
  const allStates=['PE','AL','PB','SP'];
  const visibleStates=restricted
    ? [...new Set(assigned(state.user.name).map(s=>String(s.state||'').trim().toUpperCase()).filter(Boolean))]
    : allStates;
  const states=visibleStates.filter(uf=>allStates.includes(uf));
  const taxes=['ICMS','PIS/COFINS','SPED ICMS','Fronteiras'];
  const by=(uf,tax)=>configs.find(x=>String(x.state).toUpperCase()===uf&&x.tax_name===tax)?.due_day??'';
  const isSaved=uf=>configs.some(x=>String(x.state).toUpperCase()===uf);

  const card=uf=>{
    const saved=isSaved(uf);
    return '<article class="card deadline-state-card'+(saved?' is-saved':'')+'" data-state="'+uf+'">'+
      '<div class="deadline-card-head"><div><h3>'+uf+'</h3><p>Vencimentos estaduais</p></div><span class="badge blue">Prazos fiscais</span></div>'+
      '<div class="deadline-fields">'+
      taxes.map(t=>'<div class="field"><label>'+t+'</label><input class="deadline-input" data-state="'+uf+'" data-tax="'+t+'" type="number" min="1" max="31" value="'+esc(by(uf,t))+'" '+(canEdit&&!saved?'':'disabled')+' placeholder="Dia"></div>').join('')+
      '<div class="field"><label>ISS</label><button type="button" class="secondary iss-open" data-state="'+uf+'">Ver cidades e vencimentos</button></div>'+
      '</div>'+
      (canEdit?'<div class="deadline-actions">'+
        '<button type="button" class="primary save-state-deadlines" data-state="'+uf+'" '+(saved?'disabled':'')+'>'+ (saved?'Prazo salvo':'Salvar prazos '+uf) +'</button>'+
        (saved?'<button type="button" class="secondary alter-state-deadlines" data-state="'+uf+'">Alterar prazo</button>':'')+
      '</div>':'')+
    '</article>';
  };

  c.innerHTML='<div class="section-title"><div><h2>Calendário de Prazos</h2><p class="muted">Vencimentos mensais por estado. Gestão, Coordenador e Desenvolvedor podem editar.</p></div></div>'+
    '<div class="grid two deadline-states">'+states.map(card).join('')+'</div>';

  const lockCard=uf=>{
    const card=c.querySelector('.deadline-state-card[data-state="'+CSS.escape(uf)+'"]');
    if(!card)return;
    card.classList.add('is-saved');
    card.querySelectorAll('.deadline-input').forEach(input=>input.disabled=true);
    const save=card.querySelector('.save-state-deadlines');
    if(save){save.disabled=true;save.textContent='Prazo salvo';}
    if(!card.querySelector('.alter-state-deadlines')){
      const edit=document.createElement('button');
      edit.type='button';
      edit.className='secondary alter-state-deadlines';
      edit.dataset.state=uf;
      edit.textContent='Alterar prazo';
      save?.insertAdjacentElement('afterend',edit);
      edit.onclick=()=>unlockCard(uf);
    }
  };

  const unlockCard=uf=>{
    const card=c.querySelector('.deadline-state-card[data-state="'+CSS.escape(uf)+'"]');
    if(!card)return;
    card.classList.remove('is-saved');
    card.querySelectorAll('.deadline-input').forEach(input=>input.disabled=!canEdit);
    const save=card.querySelector('.save-state-deadlines');
    if(save){save.disabled=false;save.textContent='Salvar prazos '+uf;}
    card.querySelector('.alter-state-deadlines')?.remove();
    card.querySelector('.deadline-input:not([disabled])')?.focus();
  };

  const saveState=async(uf,btn)=>{
    const inputs=[...c.querySelectorAll('.deadline-input[data-state="'+CSS.escape(uf)+'"]')];
    const items=[];
    for(const input of inputs){
      const raw=input.value.trim();
      const day=raw===''?null:Number(raw);
      if(day!==null&&(!Number.isInteger(day)||day<1||day>31)){
        input.setCustomValidity('Informe um dia inteiro entre 1 e 31.');
        input.reportValidity();
        input.focus();
        return;
      }
      input.setCustomValidity('');
      items.push({state:uf,tax_name:input.dataset.tax,due_day:day});
    }
    btn.disabled=true;
    btn.textContent='Salvando...';
    try{
      const res=await api('/api/tax-deadlines/bulk',{method:'PUT',body:JSON.stringify({items})});
      const saved=res?.data||[];
      state.data.tax_deadlines=[
        ...(state.data.tax_deadlines||[]).filter(x=>String(x.state).toUpperCase()!==uf),
        ...saved.filter(x=>String(x.state).toUpperCase()===uf)
      ];
      inputs.forEach(input=>{
        const item=saved.find(x=>String(x.state).toUpperCase()===uf&&x.tax_name===input.dataset.tax);
        input.value=item?.due_day??'';
        input.dataset.savedValue=item?.due_day??'';
      });
      lockCard(uf);
    }catch(e){
      btn.disabled=false;
      btn.textContent='Salvar prazos '+uf;
      alert(e.message);
    }
  };

  c.querySelectorAll('.save-state-deadlines').forEach(btn=>{
    if(!btn.disabled)btn.addEventListener('click',()=>saveState(btn.dataset.state,btn));
  });
  c.querySelectorAll('.alter-state-deadlines').forEach(btn=>btn.addEventListener('click',()=>unlockCard(btn.dataset.state)));
  c.querySelectorAll('.iss-open').forEach(b=>b.onclick=()=>openIssDeadlines(c,b.dataset.state,iss,canEdit));
}
async function openIssDeadlines(c,uf,iss,canEdit){
  const cityMap=new Map();
  stores().filter(s=>String(s.state||'').toUpperCase()===uf&&s.city).forEach(s=>{
    const city=s.city.trim();if(!city)return;
    if(!cityMap.has(city))cityMap.set(city,[]);
    cityMap.get(city).push(s);
  });
  const configured=new Map((iss||[]).filter(x=>String(x.state||'').toUpperCase()===uf).map(x=>[String(x.city||'').trim().toUpperCase(),x]));
  const list=[...cityMap.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const row=city=>{
    const key=city.toUpperCase(),saved=configured.get(key),items=cityMap.get(city);
    const storeDays=[...new Set(items.map(s=>s.iss_due_day).filter(v=>v!==null&&v!==undefined&&v!==''))];
    const value=saved?.due_day??(storeDays.length===1?storeDays[0]:'');
    return '<div class="metric" style="gap:12px;align-items:center"><span>'+esc(city)+'</span><div style="display:flex;gap:8px;align-items:center">'+(canEdit?'<input class="iss-day" data-city="'+esc(city)+'" type="number" min="1" max="31" step="1" value="'+esc(value)+'" placeholder="Dia" style="width:90px"><button type="button" class="primary iss-save" data-city="'+esc(city)+'">Salvar</button>':'<strong>'+(value?'Dia '+esc(value):'Não informado')+'</strong>')+'</div></div>';
  };
  const modal=document.createElement('div');modal.className='modal-backdrop';modal.innerHTML='<div class="card" style="max-width:760px;width:92%;max-height:80vh;overflow:auto"><div class="title"><h3>ISS — '+uf+'</h3><button type="button" id="close-iss">Fechar</button></div><p class="muted">Os municípios são definidos exclusivamente no cadastro das lojas em Carteiras. '+(canEdit?'Aqui você pode incluir ou alterar somente o dia de vencimento dos municípios já cadastrados.':'Consulta dos vencimentos cadastrados.')+'</p><div id="iss-list">'+(list.length?list.map(row).join(''):'<div class="empty">Nenhuma cidade cadastrada para este estado.</div>')+'</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#close-iss').onclick=()=>modal.remove();
  modal.querySelectorAll('.iss-save').forEach(btn=>btn.onclick=async()=>{
    const input=modal.querySelector('.iss-day[data-city="'+CSS.escape(btn.dataset.city)+'"]'),raw=input.value.trim();
    if(raw!==''&&(Number(raw)<1||Number(raw)>31||!Number.isInteger(Number(raw)))){alert('Informe um dia entre 1 e 31.');return}
    btn.disabled=true;btn.textContent='Salvando...';
    try{
      const res=await api('/api/iss-deadlines',{method:'PUT',body:JSON.stringify({state:uf,city:btn.dataset.city,due_day:raw===''?null:Number(raw)})});
      const item=res.data,ix=(iss||[]).findIndex(x=>String(x.state).toUpperCase()===uf&&String(x.city).trim().toUpperCase()===btn.dataset.city.trim().toUpperCase());
      if(ix>=0)iss[ix]=item;else iss.push(item);
      state.data.iss_deadlines=iss;
      state.data.stores=(state.data.stores||[]).map(s=>String(s.state||'').toUpperCase()===uf&&String(s.city||'').trim().toUpperCase()===btn.dataset.city.trim().toUpperCase()?{...s,iss_due_day:item.due_day}:s);
      input.value=item.due_day??'';
      btn.textContent='Salvo';setTimeout(()=>btn.textContent='Salvar',700);
    }catch(e){alert(e.message);btn.textContent='Salvar'}finally{btn.disabled=false}
  });
}

async function equipe(c){
  try{
    const rows=(await api('/api/team')).data||[];
    const canManage=['Gestão','Desenvolvedor','Coordenador'].includes(state.user.profile);
    const visible=rows.filter(r=>r.status!=='inactive');
    const seniors=[...new Set(visible.map(x=>x.seniority).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const profiles=[...new Set(visible.map(x=>x.profile).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    c.innerHTML='<div class="section-title"><div><h2>Equipe</h2><p class="muted">Colaboradores autorizados para o seu nível de acesso.</p></div></div>'+
      '<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">'+
      '<div class="field" style="width:220px"><label>Perfil</label><select id="eq-profile"><option value="">Todos os perfis</option>'+profiles.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></div>'+
      '<div class="field" style="width:220px"><label>Senioridade</label><select id="eq-seniority"><option value="">Todas</option>'+seniors.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></div></div></div>'+
      '<div id="eq-table"></div>';
    const draw=()=>{
      const pf=c.querySelector('#eq-profile').value, sn=c.querySelector('#eq-seniority').value;
      const filtered=visible.filter(r=>(!pf||r.profile===pf)&&(!sn||r.seniority===sn));
      const cols=[['name','Colaborador'],['profile','Perfil'],['seniority','Senioridade'],['coordinator_name','Coordenador'],['manager_name','Gerente'],['portfolio_count','Carteiras']];
      c.querySelector('#eq-table').innerHTML=table(cols,filtered,'Nenhum colaborador encontrado.');
    };
    c.querySelector('#eq-profile').onchange=draw;
    c.querySelector('#eq-seniority').onchange=draw;
    draw();
  }catch(e){c.innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}

function managementPage(c){const can=['Gestão','Desenvolvedor'].includes(state.user.profile);c.innerHTML=`<div class="section-title"><div><h2>Gestão da equipe</h2><p class="muted">Acompanhamento individual e administração dos acessos.</p></div>${can?'<button class="primary action-button" id="new-collaborator">+ Novo colaborador</button>':''}</div><div class="grid kpis">${[['Analistas ativos',analysts().length],['Lojas ativas',stores().length],['Conclusão geral',pct(stores())+'%'],['Alertas',(state.data.deadlines||[]).filter(x=>x.status==='late').length],['Carteiras',analysts().filter(a=>assigned(a.name).length).length]].map(x=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('')}</div><div class="card section"><div class="title"><h3>Acompanhamento individual</h3><span class="badge blue">Analistas ativos</span></div><div class="grid three">${analysts().map(a=>`<button class="analyst" data-name="${esc(a.name)}"><b>${esc(a.name)}</b><small>${esc(a.level||'')} · ${assigned(a.name).length} lojas · ${pct(assigned(a.name))}%</small></button>`).join('')}</div><div id="individual" class="section"></div></div>`;c.querySelectorAll('.analyst').forEach(b=>b.onclick=()=>{document.querySelectorAll('.analyst').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('#individual').innerHTML=table([['number','Loja'],['name','Nome'],['document','CNPJ'],['state','Estado'],['state_registration','Inscrição Estadual'],['municipal_registration','Inscrição Municipal']],assigned(b.dataset.name),'Nenhuma loja vinculada a este analista.')});c.querySelector('#new-collaborator')?.addEventListener('click',async()=>{const options=await api('/api/team/options');renderCollaboratorForm(c,options)})}
function renderCollaboratorForm(c,options){const co=(options.coordinators||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');const ma=(options.managers||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');c.innerHTML=`<div class="card form-card"><div class="form-header"><div><h2>Novo colaborador</h2><p class="muted">Cadastre acesso, perfil e posição na hierarquia.</p></div></div><form id="collaborator-form" class="form-grid"><div class="field"><label>Nome</label><input id="new-name" required></div><div class="field"><label>Usuário</label><input id="new-username" required></div><div class="field"><label>Senha inicial</label><input id="new-password" type="password" minlength="12" required><small>Mínimo de 12 caracteres.</small></div><div class="field"><label>Perfil</label><select id="new-profile" required><option value="">Selecione</option><option>Assistente</option><option>Analista</option><option>Coordenador</option></select></div><div class="field" id="seniority-field"><label>Senioridade</label><select id="new-seniority"><option value="">Selecione</option><option value="junior">Júnior</option><option value="pleno">Pleno</option><option value="senior">Sênior</option></select></div><div class="field" id="coordinator-field"><label>Coordenador responsável</label><select id="new-coordinator"><option value="">Selecione</option>${co}</select></div><div class="field"><label>Gerente responsável</label><select id="new-manager" required>${ma}</select></div><div class="field"><label>Situação do colaborador</label><select id="new-situation" required><option value="Ativo" selected>Ativo</option><option value="Férias">Férias</option><option value="Licença médica">Licença médica</option><option value="Desligado">Desligado</option><option value="Pediu demissão">Pediu demissão</option></select></div><div class="form-actions"><button type="button" id="cancel-new">Cancelar</button><button class="primary form-submit" type="submit">Cadastrar colaborador</button></div></form></div>`;const form=document.querySelector('#collaborator-form');const profile=document.querySelector('#new-profile');const sf=document.querySelector('#seniority-field');const cf=document.querySelector('#coordinator-field');const coord=document.querySelector('#new-coordinator');const update=()=>{const coo=profile.value==='Coordenador';sf.style.display=coo?'none':'grid';cf.style.display=coo?'none':'grid';coord.required=!coo};profile.onchange=update;update();document.querySelector('#cancel-new').onclick=loadPage;form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('.form-submit');btn.disabled=true;btn.textContent='Cadastrando...';try{const password=document.querySelector('#new-password').value;const salt=crypto.getRandomValues(new Uint8Array(16));const derived=await derive(password,salt,PASSWORD_ITERATIONS);const passwordHash=`pbkdf2-sha256$${PASSWORD_ITERATIONS}$${b64url(salt)}$${b64url(derived)}`;await api('/api/team/create',{method:'POST',body:JSON.stringify({name:document.querySelector('#new-name').value.trim(),username:document.querySelector('#new-username').value.trim().toLowerCase(),password_hash:passwordHash,profile:profile.value,seniority:document.querySelector('#new-seniority').value,coordinator_user_id:document.querySelector('#new-coordinator').value,manager_user_id:document.querySelector('#new-manager').value,situation:document.querySelector('#new-situation').value})});alert('Colaborador cadastrado com sucesso.');loadPage()}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Cadastrar colaborador'}}}
async function start(){try{if(!state.user){const me=await api('/api/auth/me');state.user=me.user}renderShell();await loadPage()}catch{sessionStorage.removeItem('fiscal_token');state.token=null;renderLogin()}}
start();
// deploy: publicar os rótulos aprovados da Curva ABC sem alterar comportamento
