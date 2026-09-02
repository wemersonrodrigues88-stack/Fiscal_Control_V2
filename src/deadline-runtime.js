const TAXES = ['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const STATES = ['PE','AL','PB','SP'];

async function sha256(value){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  let b=''; for(const x of new Uint8Array(d)) b+=String.fromCharCode(x);
  return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8'}})}
async function currentUser(request,env){
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')) return null;
  const hash=await sha256(auth.slice(7).trim());
  return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(hash).first();
}
let deadlineTablePromise=null;
async function ensureTable(env){
  if(deadlineTablePromise) return deadlineTablePromise;
  deadlineTablePromise=env.DB.prepare(`CREATE TABLE IF NOT EXISTS deadline_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    obligation TEXT NOT NULL,
    state TEXT NOT NULL,
    due_date TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    UNIQUE(obligation,state)
  )`).run().catch(error=>{
    deadlineTablePromise=null;
    throw error;
  });
  return deadlineTablePromise;
}
async function visibleStates(env,user){
  if(['Gestão','Desenvolvedor'].includes(user.profile)) return STATES;
  if(user.profile==='Analista'||user.profile==='Assistente'){
    const r=await env.DB.prepare(`SELECT DISTINCT UPPER(s.state) AS state FROM stores s JOIN portfolio_stores ps ON ps.store_id=s.id JOIN portfolios p ON p.id=ps.portfolio_id WHERE p.owner_user_id=?1 AND s.status='active'`).bind(user.id).all();
    return (r.results||[]).map(x=>x.state).filter(s=>STATES.includes(s));
  }
  if(user.profile==='Coordenador'){
    const r=await env.DB.prepare(`SELECT DISTINCT UPPER(s.state) AS state FROM stores s JOIN portfolio_stores ps ON ps.store_id=s.id JOIN portfolios p ON p.id=ps.portfolio_id JOIN team_members tm ON tm.user_id=p.owner_user_id WHERE tm.coordinator_user_id=?1 AND s.status='active'`).bind(user.id).all();
    return (r.results||[]).map(x=>x.state).filter(s=>STATES.includes(s));
  }
  return [];
}
export async function handleDeadlineRuntime(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/api/deadline-configs') return null;
  if(!env.DB) return json({error:'Serviço de banco de dados indisponível.'},503);
  const user=await currentUser(request,env);
  if(!user) return json({error:'Não autenticado.'},401);
  try{
    await ensureTable(env);
    const states=await visibleStates(env,user);
    if(request.method==='GET'){
      if(!states.length) return json({data:[]});
      const placeholders=states.map(()=>'?').join(',');
      const r=await env.DB.prepare(`SELECT id,obligation,state,due_date,updated_at FROM deadline_configs WHERE state IN (${placeholders}) AND obligation IN ('ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras') ORDER BY obligation,state`).bind(...states).all();
      return json({data:r.results||[],states});
    }
    if(request.method==='PUT'){
      if(!['Gestão','Desenvolvedor'].includes(user.profile)) return json({error:'Somente Gestão pode editar os prazos.'},403);
      const body=await request.json().catch(()=>null); const items=Array.isArray(body?.items)?body.items:[];
      for(const item of items){
        const obligation=String(item?.obligation||'').trim();
        const state=String(item?.state||'').trim().toUpperCase();
        const due=String(item?.due_date||'').trim();
        if(!TAXES.includes(obligation)||!STATES.includes(state)) return json({error:'Imposto ou estado inválido.'},400);
        if(due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return json({error:'Data inválida.'},400);
        if(!due) await env.DB.prepare('DELETE FROM deadline_configs WHERE obligation=?1 AND state=?2').bind(obligation,state).run();
        else await env.DB.prepare(`INSERT INTO deadline_configs(obligation,state,due_date,updated_at,updated_by) VALUES(?1,?2,?3,CURRENT_TIMESTAMP,?4) ON CONFLICT(obligation,state) DO UPDATE SET due_date=excluded.due_date,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`).bind(obligation,state,due,user.id).run();
      }
      return json({ok:true});
    }
    return json({error:'Método não permitido.'},405);
  }catch(error){console.error('Deadline runtime error:',error);return json({error:'Não foi possível carregar ou salvar os prazos.'},500)}
}
