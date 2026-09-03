const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8' };
const TAX = ['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const STORE_COLUMNS = {
  address: 'TEXT', street: 'TEXT', neighborhood: 'TEXT', state: 'TEXT',
  state_registration: 'TEXT', municipal_registration: 'TEXT'
};

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function unauthorized(){ return json({error:'Não autenticado.'},401); }
async function sha256(value){ const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); let b=''; for(const x of new Uint8Array(d)) b+=String.fromCharCode(x); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function currentUser(request,env){
  const auth=request.headers.get('Authorization')||''; if(!auth.startsWith('Bearer ')) return null;
  const hash=await sha256(auth.slice(7).trim());
  return env.DB.prepare(`SELECT u.id,u.username,u.name,u.status,p.name AS profile,tm.seniority,tm.coordinator_user_id,tm.manager_user_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id LEFT JOIN team_members tm ON tm.user_id=u.id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(hash).first();
}
function management(u){return ['Desenvolvedor','Gestão','Coordenador'].includes(u?.profile)}
async function audit(env,u,request,action,entity=null,id=null){try{await env.DB.prepare(`INSERT INTO audit_log (user_id,request_id,method,path,action,entity_type,entity_id) VALUES (?1,?2,?3,?4,?5,?6,?7)`).bind(u?.id||null,crypto.randomUUID(),request.method,new URL(request.url).pathname,action,entity,id).run()}catch{}}
async function ensureStoreSchema(env){
  for(const [column,type] of Object.entries(STORE_COLUMNS)){
    try{await env.DB.prepare(`ALTER TABLE stores ADD COLUMN ${column} ${type}`).run()}catch{}
  }
}
async function storesQuery(env,ownerUserId=null){
  let sql=`SELECT s.id,s.code AS number,s.name,s.document AS document,s.address,s.street,s.neighborhood,s.state,s.state_registration,s.municipal_registration,COALESCE(u.name,'') AS analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users u ON u.id=p.owner_user_id AND u.status='active' WHERE s.status='active'`;
  const params=[];
  if(ownerUserId!==null){sql+=` AND EXISTS (SELECT 1 FROM portfolio_stores ps2 JOIN portfolios p2 ON p2.id=ps2.portfolio_id WHERE ps2.store_id=s.id AND p2.owner_user_id=?1)`;params.push(ownerUserId)}
  sql+=` GROUP BY s.id ORDER BY s.name`;
  const r=params.length?await env.DB.prepare(sql).bind(...params).all():await env.DB.prepare(sql).all();
  return r.results||[];
}
async function state(env,user){
  const period=new Date().toISOString().slice(0,7);
  const ownerUserId=['Analista','Assistente'].includes(user.profile)?user.id:null;
  const [analysts,stores,execs,deadlines,history]=await Promise.all([
    env.DB.prepare(`SELECT u.id,u.name,tm.seniority AS level,'Ativo' AS status FROM users u JOIN profiles p ON p.id=u.profile_id LEFT JOIN team_members tm ON tm.user_id=u.id WHERE u.status='active' AND p.name='Analista' ORDER BY u.name`).all(),
    storesQuery(env,ownerUserId),
    env.DB.prepare(`SELECT o.id,o.store_id,o.name AS obligation,o.status,o.updated_at,o.responsible_user_id FROM obligations o WHERE o.competence_period=?1`).bind(period).all(),
    env.DB.prepare(`SELECT d.id,o.name AS obligation,d.due_date,d.status FROM deadlines d JOIN obligations o ON o.id=d.obligation_id WHERE o.competence_period=?1 ORDER BY d.due_date`).bind(period).all(),
    env.DB.prepare(`SELECT id,entity_type,entity_id,action,description,created_at FROM history ORDER BY created_at DESC LIMIT 100`).all()
  ]);
  let visibleStores=stores;
  const visibleIds=new Set(visibleStores.map(s=>String(s.id)));
  const executions=(execs.results||[]).filter(x=>visibleIds.has(String(x.store_id)));
  return json({user,analysts:analysts.results||[],stores:visibleStores,executions,deadlines:deadlines.results||[],history:history.results||[],obligations:TAX});
}
async function updateExecution(request,env,user){
  const b=await request.json().catch(()=>null); const storeId=Number(b?.store_id); const obligation=String(b?.obligation||''); const status=String(b?.status||'');
  if(!storeId||!TAX.includes(obligation)||!['Pendente','Analisando','Finalizado'].includes(status)) return json({error:'Dados inválidos.'},400);
  if(user.profile==='Analista'||user.profile==='Assistente'){
    const own=await env.DB.prepare(`SELECT 1 FROM stores s JOIN portfolio_stores ps ON ps.store_id=s.id JOIN portfolios p ON p.id=ps.portfolio_id WHERE s.id=?1 AND p.owner_user_id=?2 AND s.status='active'`).bind(storeId,user.id).first();
    if(!own) return json({error:'Você só pode alterar sua própria carteira.'},403);
  } else if(!['Gestão','Coordenador','Desenvolvedor'].includes(user.profile)) return json({error:'Sem permissão.'},403);
  const current=await env.DB.prepare(`SELECT id FROM obligations WHERE store_id=?1 AND name=?2 ORDER BY id DESC LIMIT 1`).bind(storeId,obligation).first();
  const now=new Date().toISOString();
  if(current) await env.DB.prepare(`UPDATE obligations SET status=?1,updated_at=?2,responsible_user_id=?3 WHERE id=?4`).bind(status,now,user.id,current.id).run();
  else await env.DB.prepare(`INSERT INTO obligations(name,competence_period,status,store_id,responsible_user_id,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?6)`).bind(obligation,new Date().toISOString().slice(0,7),status,storeId,user.id,now).run();
  try{await env.DB.prepare(`INSERT INTO history(user_id,entity_type,entity_id,action,description) VALUES(?1,'execution',?2,'UPDATE',?3)`).bind(user.id,storeId,JSON.stringify({obligation,status})).run()}catch{}
  return json({ok:true});
}
async function updateStore(request,env,user){
  if(!management(user)) return json({error:'Somente Gestão e Desenvolvedor podem editar os dados cadastrais das lojas.'},403);
  const url=new URL(request.url); const id=Number(url.pathname.split('/').pop()); if(!id) return json({error:'Loja inválida.'},400);
  const b=await request.json().catch(()=>null); if(!b) return json({error:'Dados inválidos.'},400);
  const name=String(b.name||'').trim(); const code=String(b.number||'').trim();
  if(!name||!code) return json({error:'Número da loja e nome da loja são obrigatórios.'},400);
  const exists=await env.DB.prepare('SELECT id FROM stores WHERE id=?1').bind(id).first(); if(!exists) return json({error:'Loja não encontrada.'},404);
  try{
    await env.DB.prepare(`UPDATE stores SET code=?1,name=?2,document=?3,address=?4,street=?5,neighborhood=?6,state=?7,state_registration=?8,municipal_registration=?9,updated_at=?10 WHERE id=?11`).bind(code,name,String(b.document||''),String(b.address||''),String(b.street||''),String(b.neighborhood||''),String(b.state||''),String(b.state_registration||''),String(b.municipal_registration||''),new Date().toISOString(),id).run();
    if(b.analyst_id!==undefined && b.analyst_id!==null && String(b.analyst_id)!==''){
      const analystId=Number(b.analyst_id);
      const analyst=await env.DB.prepare(`SELECT u.id,u.name FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.id=?1 AND u.status='active' AND p.name='Analista'`).bind(analystId).first();
      if(!analyst) return json({error:'Analista inválido.'},400);
      const links=await env.DB.prepare(`SELECT portfolio_id FROM portfolio_stores WHERE store_id=?1 ORDER BY portfolio_id`).bind(id).all();
      if((links.results||[]).length){
        const portfolioId=links.results[0].portfolio_id;
        await env.DB.prepare('UPDATE portfolios SET owner_user_id=?1 WHERE id=?2').bind(analystId,portfolioId).run();
        await env.DB.prepare('INSERT OR IGNORE INTO analyst_portfolios(analyst_user_id,portfolio_id) VALUES(?1,?2)').bind(analystId,portfolioId).run();
        for(const old of links.results.slice(1)) await env.DB.prepare('UPDATE portfolios SET owner_user_id=?1 WHERE id=?2').bind(analystId,old.portfolio_id).run();
      } else {
        const portfolioName=`Loja ${code} - ${name}`;
        const existingPortfolio=await env.DB.prepare('SELECT id FROM portfolios WHERE name=?1').bind(portfolioName).first();
        let portfolioId=existingPortfolio?.id;
        if(!portfolioId){const ins=await env.DB.prepare('INSERT INTO portfolios(name,description,owner_user_id) VALUES(?1,?2,?3)').bind(portfolioName,'Carteira vinculada à loja',analystId).run(); portfolioId=ins.meta?.last_row_id;}
        if(portfolioId){await env.DB.prepare('INSERT OR IGNORE INTO portfolio_stores(portfolio_id,store_id) VALUES(?1,?2)').bind(portfolioId,id).run();await env.DB.prepare('INSERT OR IGNORE INTO analyst_portfolios(analyst_user_id,portfolio_id) VALUES(?1,?2)').bind(analystId,portfolioId).run();}
      }
    }
    await audit(env,user,request,'update_store','store',id);
    try{await env.DB.prepare(`INSERT INTO history(user_id,entity_type,entity_id,action,description) VALUES(?1,'store',?2,'UPDATE',?3)`).bind(user.id,id,JSON.stringify({name,code})).run()}catch{}
    const result=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.document AS document,s.address,s.street,s.neighborhood,s.state,s.state_registration,s.municipal_registration,COALESCE(u.name,'') AS analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users u ON u.id=p.owner_user_id AND u.status='active' WHERE s.id=?1 GROUP BY s.id`).bind(id).first();
    return json({ok:true,data:result});
  }catch(error){console.error('Store update error:',error);return json({error:'Não foi possível salvar os dados da loja.'},500)}
}
async function api(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!env.DB) return json({error:'Serviço de banco de dados indisponível.'},503);
  try{
    if(path==='/api/health') return json({ok:true,app:env.APP_NAME,version:env.APP_VERSION});
    const user=await currentUser(request,env);
    if(path==='/api/auth/me'){if(!user)return unauthorized();return json({user});}
    if(path==='/api/auth/logout'&&request.method==='POST'){
      if(!user)return unauthorized(); const auth=request.headers.get('Authorization')||''; if(auth.startsWith('Bearer ')){const h=await sha256(auth.slice(7).trim());await env.DB.prepare('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?1').bind(h).run();} return json({ok:true});
    }
    if(!user)return unauthorized();
    if(path==='/api/state'&&request.method==='GET'){await audit(env,user,request,'read_state');return state(env,user)}
    if(path==='/api/executions'&&request.method==='PUT')return updateExecution(request,env,user);
    if(path==='/api/stores'&&request.method==='GET'){const s=await storesQuery(env);return json({data:s});}
    if(path.startsWith('/api/stores/')&&request.method==='PUT')return updateStore(request,env,user);
    if(path==='/api/dashboard'&&request.method==='GET'){
      const s=await state(env,user); const d=await s.json(); const visible=d.stores||[]; const done=(d.executions||[]).filter(x=>x.status==='Finalizado').length; const running=(d.executions||[]).filter(x=>x.status==='Analisando').length; return json({data:{activeAnalysts:(d.analysts||[]).length,activeStores:visible.length,obligations:visible.length*TAX.length,pending:Math.max(0,visible.length*TAX.length-done-running),overdue:(d.deadlines||[]).filter(x=>x.status==='late').length}});
    }
    if(path==='/api/team'&&request.method==='GET'){
      let sql=`SELECT u.id,u.name,u.username,p.name AS profile,tm.seniority,tm.coordinator_user_id,tm.manager_user_id,c.name AS coordinator_name,m.name AS manager_name,COUNT(DISTINCT ap.portfolio_id) AS portfolio_count FROM users u JOIN profiles p ON p.id=u.profile_id LEFT JOIN team_members tm ON tm.user_id=u.id LEFT JOIN users c ON c.id=tm.coordinator_user_id LEFT JOIN users m ON m.id=tm.manager_user_id LEFT JOIN analyst_portfolios ap ON ap.analyst_user_id=u.id WHERE u.status='active'`;
      const params=[]; if(['Analista','Assistente'].includes(user.profile)){sql+=' AND u.id=?1';params.push(user.id)} sql+=` GROUP BY u.id,u.name,u.username,p.name,tm.seniority,tm.coordinator_user_id,tm.manager_user_id,c.name,m.name ORDER BY u.name`;
      const r=params.length?await env.DB.prepare(sql).bind(...params).all():await env.DB.prepare(sql).all(); return json({data:r.results||[]});
    }
    if(path==='/api/team/options'&&request.method==='GET'){
      if(!management(user))return json({error:'Sem permissão.'},403); const [c,m]=await Promise.all([env.DB.prepare("SELECT u.id,u.name FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.status='active' AND p.name='Coordenador' ORDER BY u.name").all(),env.DB.prepare("SELECT u.id,u.name FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.status='active' AND p.name IN ('Gerente','Gestão') ORDER BY u.name").all()]); return json({coordinators:c.results||[],managers:m.results||[]});
    }
    if(path==='/api/portfolios'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM portfolios ORDER BY name').all();return json({data:r.results||[]});}
    return json({error:'Rota não encontrada.'},404);
  }catch(error){console.error('API error:',error);return json({error:'Erro interno do servidor.'},500)}
}
export default {fetch(request,env){return api(request,env)}};