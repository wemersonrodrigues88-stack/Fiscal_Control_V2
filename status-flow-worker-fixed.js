import baseWorker from './worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const CONTROL_PROFILES=['Gestão','Gerente','Coordenador','Desenvolvedor'];
const FLOW={Gerando:'Gerando',Query:'Query',Analisando:'Analisando',Finalizando:'Finalizado'};
const CHECK_ITEMS=['quebra_sequencia','painel_inconsistencia','notas_baixa_estoque','curva_abc','ajustes_credito_debito','registro_resumo_icms','controle_fechado','contabilizacao'];
const CHECK_ALLOWED={quebra_sequencia:['feito','ha_quebras'],painel_inconsistencia:['feito'],notas_baixa_estoque:['feito'],curva_abc:['feito','incons_comercial','incons_contabil'],ajustes_credito_debito:['feito'],registro_resumo_icms:['feito'],controle_fechado:['feito'],contabilizacao:['feito']};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
const currentPeriod=()=>new Date().toISOString().slice(0,7);
function errorJson(error,stage,status=500){const requestId=crypto.randomUUID();console.error('Apurações diagnostic',JSON.stringify({requestId,stage,error:error?.message||String(error)}));return json({error:error?.message||'Erro interno das Apurações.',diagnostic:{requestId,stage,type:error?.name||'Error',message:error?.message||String(error)}},status)}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}
async function ensure(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS apuracoes_flow(store_id INTEGER NOT NULL,obligation TEXT NOT NULL,competence_period TEXT NOT NULL,phase TEXT NOT NULL,query_generated_at TEXT,analyzing_at TEXT,finalizing_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by INTEGER,PRIMARY KEY(store_id,obligation,competence_period))`).run();await env.DB.prepare(`CREATE TABLE IF NOT EXISTS icms_checklist(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id INTEGER NOT NULL,competence_period TEXT NOT NULL,item_key TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by INTEGER,UNIQUE(store_id,competence_period,item_key))`).run();await env.DB.prepare(`CREATE TABLE IF NOT EXISTS icms_debtor_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id INTEGER NOT NULL,competence_period TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'aguardando_transferencia',requested_by INTEGER,requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,resolved_by INTEGER,resolved_at TEXT,UNIQUE(store_id,competence_period))`).run()}
async function flowFor(env,p){const r=await env.DB.prepare(`SELECT * FROM apuracoes_flow WHERE competence_period=?1`).bind(p).all();return new Map((r.results||[]).map(x=>[`${x.store_id}|${x.obligation}`,x]))}
async function visibleStore(env,u,id){const r=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(u2.name,'') analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users u2 ON u2.id=p.owner_user_id AND u2.status='active' WHERE s.id=?1 AND s.status='active' GROUP BY s.id`).bind(id).first();if(!r)return false;if(CONTROL_PROFILES.includes(u.profile))return true;return ['Analista','Assistente'].includes(u.profile)&&r.analyst===u.name}
async function visibleStores(env,u){const managed=CONTROL_PROFILES.includes(u.profile);if(managed){const r=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(u2.name,'') analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users u2 ON u2.id=p.owner_user_id AND u2.status='active' WHERE s.status='active' GROUP BY s.id ORDER BY CAST(s.code AS INTEGER),s.code`).all();return r.results||[]}if(u.profile==='Analista'||u.profile==='Assistente'){const r=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(u2.name,'') analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users u2 ON u2.id=p.owner_user_id AND u2.status='active' WHERE s.status='active' AND EXISTS (SELECT 1 FROM portfolio_stores ps2 JOIN portfolios p2 ON p2.id=ps2.portfolio_id WHERE ps2.store_id=s.id AND p2.owner_user_id=?1) GROUP BY s.id ORDER BY CAST(s.code AS INTEGER),s.code`).bind(u.id).all();return r.results||[]}return []}
async function safeApData(env,u){const stores=await visibleStores(env,u);if(!stores.length)return {stores,items:[],checklist:[]};const p=currentPeriod(),managed=CONTROL_PROFILES.includes(u.profile),params=managed?[p]:[p,u.id];const ownerExecution=managed?'':' AND EXISTS (SELECT 1 FROM portfolio_stores ps JOIN portfolios p2 ON p2.id=ps.portfolio_id WHERE ps.store_id=ec.store_id AND p2.owner_user_id=?2)';const ownerChecklist=managed?'':' AND EXISTS (SELECT 1 FROM portfolio_stores ps JOIN portfolios p2 ON p2.id=ps.portfolio_id WHERE ps.store_id=c.store_id AND p2.owner_user_id=?2)';const [executionResult,checklistResult,flowMap,debtorResult]=await Promise.all([env.DB.prepare(`SELECT ec.store_id,ec.obligation,ec.status,ec.started_at,ec.analyzing_at,ec.finished_at,ec.updated_at FROM execution_control ec JOIN stores s ON s.id=ec.store_id WHERE ec.competence_period=?1 AND s.status='active'${ownerExecution}`).bind(...params).all().catch(error=>{console.error('Apurações execution_control read:',error);return {results:[]}}),env.DB.prepare(`SELECT c.store_id,c.item_key,c.status,c.updated_at FROM icms_checklist c JOIN stores s ON s.id=c.store_id WHERE c.competence_period=?1 AND s.status='active'${ownerChecklist}`).bind(...params).all().catch(error=>{console.error('Apurações icms_checklist read:',error);return {results:[]}}),flowFor(env,p).catch(error=>{console.error('Apurações flow read:',error);return new Map()}),env.DB.prepare('SELECT store_id,status,requested_at,resolved_at FROM icms_debtor_requests WHERE competence_period=?1').bind(p).all().catch(error=>{console.error('Apurações icms_debtor_requests read:',error);return {results:[]}})]);const executions=executionResult.results||[],checklist=checklistResult.results||[],debtorMap=new Map((debtorResult.results||[]).map(x=>[x.store_id,x]));const map=new Map(executions.map(x=>[`${x.store_id}|${x.obligation}`,x]));const items=[];for(const s of stores)for(const tax of TAXES){const x=map.get(`${s.id}|${tax}`),f=flowMap.get(`${s.id}|${tax}`);const debtor=tax==='ICMS'?debtorMap.get(s.id):null;const item={...s,store_id:s.id,obligation:tax,status:x?.status||'Pendente',started_at:x?.started_at||null,analyzing_at:x?.analyzing_at||null,finished_at:x?.finished_at||null,updated_at:x?.updated_at||null,icms_debtor_status:debtor?.status||null,icms_debtor_requested_at:debtor?.requested_at||null,icms_debtor_resolved_at:debtor?.resolved_at||null};if(f){item.flow_phase=f.phase;item.query_generated_at=f.query_generated_at;item.flow_analyzing_at=f.analyzing_at;item.finalizing_at=f.finalizing_at;if(f.phase===FLOW.Query)item.status='Query geradas';else if(f.phase===FLOW.Analisando)item.status='Analisando';else if(f.phase===FLOW.Finalizando||f.phase==='Finalizado')item.status='Finalizado';else if(f.phase===FLOW.Gerando)item.status='Gerando Query'}items.push(item)}return {stores,items,checklist};}
async function customStatus(req,env,u){
 const b=await req.json().catch(()=>null),storeId=Number(b?.store_id),tax=String(b?.obligation||''),requested=String(b?.status||'');
 if(!storeId||!TAXES.includes(tax)||!['Gerando','Query','Analisando','Finalizado'].includes(requested))return json({error:'Dados inválidos.'},400);
 if(!['Analista','Assistente'].includes(u.profile))return json({error:'Apenas analistas e assistentes podem executar esta sequência.'},403);
 if(!(await visibleStore(env,u,storeId)))return json({error:'Loja fora da sua carteira.'},403);
 await ensure(env);
 const p=currentPeriod(),cur=await env.DB.prepare('SELECT * FROM execution_control WHERE store_id=?1 AND obligation=?2 AND competence_period=?3').bind(storeId,tax,p).first(),f=await env.DB.prepare('SELECT * FROM apuracoes_flow WHERE store_id=?1 AND obligation=?2 AND competence_period=?3').bind(storeId,tax,p).first(),phase=f?.phase||'Pendente',t=new Date().toISOString();
 if(requested==='Gerando'){
   if(phase!=='Pendente'||cur?.status&&cur.status!=='Pendente')return json({error:'A apuração já foi iniciada.'},409);
   if(cur)await env.DB.prepare("UPDATE execution_control SET status='Gerando',started_at=COALESCE(started_at,?1),updated_at=?1,updated_by=?2 WHERE id=?3").bind(t,u.id,cur.id).run();
   else await env.DB.prepare("INSERT INTO execution_control(store_id,obligation,competence_period,status,started_at,updated_at,updated_by) VALUES(?1,?2,?3,'Gerando',?4,?4,?5)").bind(storeId,tax,p,t,u.id).run();
   await env.DB.prepare("INSERT INTO apuracoes_flow(store_id,obligation,competence_period,phase,updated_at,updated_by) VALUES(?1,?2,?3,'Gerando',?4,?5)").bind(storeId,tax,p,t,u.id).run();
   return json({ok:true,phase:'Gerando'});
 }
 if(requested==='Query'&&phase==='Gerando'){
   await env.DB.prepare("UPDATE apuracoes_flow SET phase='Query',query_generated_at=?1,updated_at=?1,updated_by=?2 WHERE store_id=?3 AND obligation=?4 AND competence_period=?5").bind(t,u.id,storeId,tax,p).run();
   return json({ok:true,phase:'Query'});
 }
 if(requested==='Analisando'&&phase==='Query'){
   await env.DB.prepare("UPDATE execution_control SET status='Analisando',analyzing_at=?1,updated_at=?1,updated_by=?2 WHERE store_id=?3 AND obligation=?4 AND competence_period=?5").bind(t,u.id,storeId,tax,p).run();
   await env.DB.prepare("UPDATE apuracoes_flow SET phase='Analisando',analyzing_at=?1,updated_at=?1,updated_by=?2 WHERE store_id=?3 AND obligation=?4 AND competence_period=?5").bind(t,u.id,storeId,tax,p).run();
   return json({ok:true,phase:'Analisando'});
 }
 if(requested==='Finalizado'&&phase==='Analisando'){
   if(tax==='ICMS'){
     const debtor=await env.DB.prepare('SELECT status FROM icms_debtor_requests WHERE store_id=?1 AND competence_period=?2').bind(storeId,p).first();
     if(debtor?.status==='aguardando_transferencia')return json({error:'A loja está aguardando transferência de crédito. Aguarde a decisão do responsável.'},409);
   }
   await env.DB.prepare("UPDATE execution_control SET status='Finalizado',finished_at=?1,updated_at=?1,updated_by=?2 WHERE store_id=?3 AND obligation=?4 AND competence_period=?5").bind(t,u.id,storeId,tax,p).run();
   await env.DB.prepare("UPDATE apuracoes_flow SET phase='Finalizado',finalizing_at=?1,updated_at=?1,updated_by=?2 WHERE store_id=?3 AND obligation=?4 AND competence_period=?5").bind(t,u.id,storeId,tax,p).run();
   return json({ok:true,phase:'Finalizado'});
 }
 return json({error:`Sequência inválida. Etapa atual: ${phase}.`},409);
}
async function icmsDebtor(req,env){
  const u=await auth(req,env);if(!u)return json({error:'Não autenticado.'},401);
  const b=await req.json().catch(()=>null),storeId=Number(b?.store_id),action=String(b?.action||'');
  if(!storeId||!['request','approve','finalize_debtor','invalid_request'].includes(action))return json({error:'Dados inválidos.'},400);
  const p=currentPeriod();await ensure(env);
  if(!(await visibleStore(env,u,storeId)))return json({error:'Loja não disponível para seu perfil.'},403);
  const now=new Date().toISOString();
  if(action==='request'){
    if(!['Analista','Assistente'].includes(u.profile))return json({error:'Somente analista ou assistente pode solicitar a transferência de crédito.'},403);
    const existing=await env.DB.prepare('SELECT * FROM icms_debtor_requests WHERE store_id=?1 AND competence_period=?2').bind(storeId,p).first();
    if(existing?.status==='aguardando_transferencia')return json({ok:true,status:existing.status});
    if(existing?.status==='solicitacao_indev'){
      await env.DB.prepare("UPDATE icms_debtor_requests SET status='aguardando_transferencia',requested_by=?1,requested_at=?2,resolved_by=NULL,resolved_at=NULL WHERE store_id=?3 AND competence_period=?4").bind(u.id,now,storeId,p).run();
      return json({ok:true,status:'aguardando_transferencia'});
    }
    if(existing)return json({error:'Esta solicitação de ICMS já foi decidida.'},409);
    await env.DB.prepare("INSERT INTO icms_debtor_requests(store_id,competence_period,status,requested_by,requested_at) VALUES(?1,?2,'aguardando_transferencia',?3,?4)").bind(storeId,p,u.id,now).run();
    try{await env.DB.prepare("INSERT INTO history(user_id,entity_type,entity_id,action,description) VALUES(?1,'icms_debtor',?2,'REQUEST',?3)").bind(u.id,storeId,`Loja devedora, aguardando transferência de crédito · ICMS · ${u.name}`).run()}catch{}
    return json({ok:true,status:'aguardando_transferencia'});
  }
  if(!CONTROL_PROFILES.includes(u.profile))return json({error:'Somente gerente, coordenador ou desenvolvedor podem decidir esta solicitação.'},403);
  const decision=action==='approve'?'transferencia_aprovada':action==='finalize_debtor'?'finalizada_devedora':'solicitacao_indev';
  const existing=await env.DB.prepare('SELECT * FROM icms_debtor_requests WHERE store_id=?1 AND competence_period=?2').bind(storeId,p).first();
  if(!existing)return json({error:'Não existe solicitação de loja devedora para esta loja.'},404);
  if(existing.status!=='aguardando_transferencia')return json({error:'Esta solicitação já foi decidida.'},409);
  await env.DB.prepare('UPDATE icms_debtor_requests SET status=?1,resolved_by=?2,resolved_at=?3 WHERE store_id=?4 AND competence_period=?5').bind(decision,u.id,now,storeId,p).run();
  try{await env.DB.prepare("INSERT INTO history(user_id,entity_type,entity_id,action,description) VALUES(?1,'icms_debtor',?2,'DECISION',?3)").bind(u.id,storeId,`${decision==='transferencia_aprovada'?'Transferência aprovada':'Finalizar como devedora'} · ICMS · ${u.name}`).run()}catch{}
  return json({ok:true,status:decision});
}
async function controlUser(req,env){
  const u=await auth(req,env);
  if(!u)return null;
  return CONTROL_PROFILES.includes(u.profile)?u:null;
}
async function rollbackAp(req,env,u){
  const b=await req.json().catch(()=>null),storeId=Number(b?.store_id),tax=String(b?.obligation||''),target=String(b?.status||'');
  if(!storeId||!TAXES.includes(tax)||!['Pendente','Gerando','Analisando'].includes(target))return json({error:'Dados inválidos.'},400);
  const p=currentPeriod();
  const cur=await env.DB.prepare('SELECT * FROM execution_control WHERE store_id=?1 AND obligation=?2 AND competence_period=?3').bind(storeId,tax,p).first();
  if(target==='Pendente'){
    if(cur)await env.DB.prepare("UPDATE execution_control SET status='Pendente',started_at=NULL,analyzing_at=NULL,finished_at=NULL,updated_at=CURRENT_TIMESTAMP,updated_by=?1 WHERE id=?2").bind(u.id,cur.id).run();
    await ensure(env);
    await env.DB.prepare('DELETE FROM apuracoes_flow WHERE store_id=?1 AND obligation=?2 AND competence_period=?3').bind(storeId,tax,p).run();
    return json({ok:true,status:'Pendente'});
  }
  await ensure(env);
  const t=new Date().toISOString();
  if(cur)await env.DB.prepare("UPDATE execution_control SET status=?1,analyzing_at=?2,finished_at=NULL,updated_at=?3,updated_by=?4 WHERE id=?5").bind(target,target==='Analisando'?t:null,t,u.id,cur.id).run();
  else await env.DB.prepare("INSERT INTO execution_control(store_id,obligation,competence_period,status,started_at,analyzing_at,updated_at,updated_by) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)").bind(storeId,tax,p,target,t,target==='Analisando'?t:null,t,u.id).run();
  const existing=await env.DB.prepare('SELECT * FROM apuracoes_flow WHERE store_id=?1 AND obligation=?2 AND competence_period=?3').bind(storeId,tax,p).first();
  if(existing)await env.DB.prepare('UPDATE apuracoes_flow SET phase=?1,query_generated_at=?2,analyzing_at=?3,finalizing_at=NULL,updated_at=?4,updated_by=?5 WHERE store_id=?6 AND obligation=?7 AND competence_period=?8').bind(target,target==='Analisando'?t:null,target==='Analisando'?t:null,t,u.id,storeId,tax,p).run();
  else await env.DB.prepare('INSERT INTO apuracoes_flow(store_id,obligation,competence_period,phase,query_generated_at,analyzing_at,updated_at,updated_by) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)').bind(storeId,tax,p,target,target==='Analisando'?t:null,target==='Analisando'?t:null,t,u.id).run();
  return json({ok:true,status:target});
}
async function getAp(req,env,u){try{return json(await safeApData(env,u))}catch(error){return errorJson(error,'GET /api/apuracoes direct D1')}}
async function apuracoesReport(req,env,u){
  const p=currentPeriod(),stores=await visibleStores(env,u);
  const ids=stores.map(s=>s.id); if(!ids.length)return json({data:{competence_period:p,generated_at:new Date().toISOString(),summary:[],finalized:[],all:[]},ok:true});
  const ec=await env.DB.prepare('SELECT ec.store_id,ec.obligation,ec.status,ec.started_at,ec.analyzing_at,ec.finished_at FROM execution_control ec WHERE ec.competence_period=?1').bind(p).all();
  const by=new Map((ec.results||[]).map(x=>[x.store_id+'|'+x.obligation,x]));
  const all=[]; for(const s of stores) for(const tax of TAXES){const x=by.get(s.id+'|'+tax)||{};all.push({...s,obligation:tax,status:x.status||'Pendente',started_at:x.started_at||null,analyzing_at:x.analyzing_at||null,finished_at:x.finished_at||null});}
  const finalized=all.filter(x=>x.status==='Finalizado');
  const summary=TAXES.map(t=>{const a=all.filter(x=>x.obligation===t);return {obligation:t,finalized:a.filter(x=>x.status==='Finalizado').length,pending:a.filter(x=>x.status!=='Finalizado').length,total_stores:a.length}});
  return json({data:{competence_period:p,generated_at:new Date().toISOString(),summary,finalized,all},ok:true});
}
async function curvaAbcReport(req,env,u){
  const p=currentPeriod(),stores=await visibleStores(env,u);
  const r=await env.DB.prepare('SELECT store_id,status FROM icms_checklist WHERE competence_period=?1 AND item_key=?2').bind(p,'curva_abc').all();
  const m=new Map((r.results||[]).map(x=>[x.store_id,x.status]));
  return json({data:stores.map(s=>({...s,curva_abc:m.get(s.id)||'Pendente'})),ok:true});
}
export default {async fetch(request,env,ctx){const url=new URL(request.url);try{
if(url.pathname==='/api/apuracoes-report'&&request.method==='GET'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);try{return await apuracoesReport(request,env,u)}catch(error){return errorJson(error,'GET /api/apuracoes-report')}}
if(url.pathname==='/api/curva-abc-report'&&request.method==='GET'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);try{return await curvaAbcReport(request,env,u)}catch(error){return errorJson(error,'GET /api/curva-abc-report')}}
if(url.pathname==='/api/icms-debtor'&&request.method==='PUT'){try{return await icmsDebtor(request,env)}catch(error){return errorJson(error,'PUT /api/icms-debtor')}}if(url.pathname==='/api/apuracoes/status'&&request.method==='PUT'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);try{return await customStatus(request,env,u)}catch(error){return errorJson(error,'PUT /api/apuracoes/status')}}
if(url.pathname==='/api/apuracoes/rollback'&&request.method==='PUT'){const u=await controlUser(request,env);if(!u)return json({error:'Não autorizado.'},403);try{return await rollbackAp(request,env,u)}catch(error){return errorJson(error,'PUT /api/apuracoes/rollback')}}
if(url.pathname==='/api/apuracoes'&&request.method==='GET'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);return getAp(request,env,u)}
if(url.pathname==='/api/icms-checklist'&&request.method==='GET'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);const stores=await visibleStores(env,u);const ids=stores.map(s=>s.id);if(!ids.length)return json({data:[],items:CHECK_ITEMS});const placeholders=ids.map(()=>'?').join(',');const r=await env.DB.prepare(`SELECT store_id,item_key,status,updated_at FROM icms_checklist WHERE competence_period=?1 AND store_id IN (${placeholders}) ORDER BY store_id,item_key`).bind(currentPeriod(),...ids).all();return json({data:r.results||[],items:CHECK_ITEMS})}if(url.pathname==='/api/icms-checklist'&&request.method==='PUT'){const u=await auth(request,env);if(!u)return json({error:'Não autenticado.'},401);if(!['Analista','Assistente'].includes(u.profile))return json({error:'Apenas analistas e assistentes podem preencher o checklist.'},403);const b=await request.json().catch(()=>null),storeId=Number(b?.store_id),item=String(b?.item_key||''),status=String(b?.status||'');if(!storeId||!CHECK_ITEMS.includes(item)||!CHECK_ALLOWED[item].includes(status))return json({error:'Dados inválidos.'},400);if(!(await visibleStore(env,u,storeId)))return json({error:'Loja fora da sua carteira.'},403);await env.DB.prepare(`INSERT INTO icms_checklist(store_id,competence_period,item_key,status,updated_at,updated_by) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(store_id,competence_period,item_key) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(storeId,currentPeriod(),item,status,new Date().toISOString(),u.id).run();return json({ok:true})}return baseWorker.fetch(request,env,ctx)}catch(error){return errorJson(error,`${request.method} ${url.pathname}`)}}};
