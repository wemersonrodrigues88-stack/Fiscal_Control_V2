import baseWorker from './status-flow-worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const GLOBAL_PROFILES=['Gestão','Gerente','Coordenador','Desenvolvedor'];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}

async function readAp(req,env,u){
  const period=new Date().toISOString().slice(0,7);
  let rows=[];
  try{
    const r=await env.DB.prepare(`WITH taxes(obligation) AS (VALUES ('ICMS'),('PIS/COFINS'),('ISS'),('SPED ICMS'),('Fronteiras'))
      SELECT s.id,s.code AS number,s.name,s.state,COALESCE(pu.name,'') AS analyst,
             t.obligation,COALESCE(e.status,'Pendente') AS status,e.started_at,e.analyzing_at,e.finished_at,e.updated_at,
             f.phase,f.query_generated_at,f.analyzing_at AS flow_analyzing_at,f.finalizing_at
      FROM stores s
      LEFT JOIN portfolio_stores ps ON ps.store_id=s.id
      LEFT JOIN portfolios p ON p.id=ps.portfolio_id
      LEFT JOIN users pu ON pu.id=p.owner_user_id AND pu.status='active'
      CROSS JOIN taxes t
      LEFT JOIN execution_control e ON e.store_id=s.id AND e.obligation=t.obligation AND e.competence_period=?1
      LEFT JOIN apuracoes_flow f ON f.store_id=s.id AND f.obligation=t.obligation AND f.competence_period=?1
      WHERE s.status='active'
      ORDER BY CAST(s.code AS INTEGER),s.code,t.obligation`).bind(period).all();
    rows=r.results||[];
  }catch(error){
    console.error('Apurações primary query:',error?.message||error);
    try{
      const r=await env.DB.prepare(`WITH taxes(obligation) AS (VALUES ('ICMS'),('PIS/COFINS'),('ISS'),('SPED ICMS'),('Fronteiras'))
        SELECT s.id,s.code AS number,s.name,s.state,COALESCE(pu.name,'') AS analyst,
               t.obligation,COALESCE(o.status,'Pendente') AS status,o.created_at AS started_at,NULL AS analyzing_at,NULL AS finished_at,o.updated_at
        FROM stores s
        LEFT JOIN portfolio_stores ps ON ps.store_id=s.id
        LEFT JOIN portfolios p ON p.id=ps.portfolio_id
        LEFT JOIN users pu ON pu.id=p.owner_user_id AND pu.status='active'
        CROSS JOIN taxes t
        LEFT JOIN obligations o ON o.store_id=s.id AND o.name=t.obligation AND o.id=(SELECT MAX(o2.id) FROM obligations o2 WHERE o2.store_id=s.id AND o2.name=t.obligation)
        WHERE s.status='active'
        ORDER BY CAST(s.code AS INTEGER),s.code,t.obligation`).all();
      rows=r.results||[];
    }catch(fallbackError){
      console.error('Apurações fallback query:',fallbackError?.message||fallbackError);
      throw fallbackError;
    }
  }

  let visible=rows;
  if(!GLOBAL_PROFILES.includes(u.profile))visible=rows.filter(x=>['Analista','Assistente'].includes(u.profile)&&x.analyst===u.name);
  const stores=[];const seen=new Set();const items=[];
  for(const x of visible){
    if(!seen.has(String(x.id))){seen.add(String(x.id));stores.push({id:x.id,number:x.number,name:x.name,state:x.state,analyst:x.analyst||''})}
    let status=x.status||'Pendente';
    if(x.phase==='Query'||x.phase==='Analisando')status='Analisando';
    else if(x.phase==='Finalizando')status='Finalizado';
    else if(x.phase==='Gerando')status='Gerando';
    items.push({id:x.id,store_id:x.id,number:x.number,name:x.name,state:x.state,analyst:x.analyst||'',obligation:x.obligation,status,started_at:x.started_at||null,analyzing_at:x.analyzing_at||null,finished_at:x.finished_at||null,updated_at:x.updated_at||null,flow_phase:x.phase||null,query_generated_at:x.query_generated_at||null,flow_analyzing_at:x.flow_analyzing_at||null,finalizing_at:x.finalizing_at||null});
  }
  return json({stores,items,checklist:[]});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    try{
      if(request.method==='GET'&&url.pathname==='/api/apuracoes'){
        const u=await auth(request,env);
        if(!u)return json({error:'Não autenticado.'},401);
        return await readAp(request,env,u);
      }
      return await baseWorker.fetch(request,env,ctx);
    }catch(error){
      console.error('Worker request error:',error);
      return json({error:error?.message||'Erro interno do Worker.'},500);
    }
  }
};