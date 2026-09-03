import baseWorker from './status-flow-worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const GLOBAL_PROFILES=['Gestão','Gerente','Coordenador','Desenvolvedor'];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}

async function readAp(req,env,u){
  const period=new Date().toISOString().slice(0,7);
  let stores=[];
  if(GLOBAL_PROFILES.includes(u.profile)){
    const r=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(pu.name,'') AS analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users pu ON pu.id=p.owner_user_id AND pu.status='active' WHERE s.status='active' GROUP BY s.id ORDER BY s.code`).all();
    stores=r.results||[];
  }else if(['Analista','Assistente'].includes(u.profile)){
    const r=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(pu.name,'') AS analyst FROM stores s JOIN portfolio_stores ps ON ps.store_id=s.id JOIN portfolios p ON p.id=ps.portfolio_id LEFT JOIN users pu ON pu.id=p.owner_user_id AND pu.status='active' WHERE s.status='active' AND p.owner_user_id=?1 GROUP BY s.id ORDER BY s.code`).bind(u.id).all();
    stores=r.results||[];
  }

  if(!stores.length)return json({stores:[],items:[],checklist:[]});

  const ids=stores.map(s=>s.id);
  const q=ids.map(()=>'?').join(',');
  let executions=[];
  try{
    const r=await env.DB.prepare(`SELECT store_id,obligation,status,started_at,analyzing_at,finished_at,updated_at FROM execution_control WHERE competence_period=?1 AND store_id IN (${q})`).bind(period,...ids).all();
    executions=r.results||[];
  }catch(error){
    console.error('Apurações execution_control read:',error?.message||error);
  }

  let flows=[];
  try{
    const r=await env.DB.prepare(`SELECT store_id,obligation,phase,query_generated_at,analyzing_at AS flow_analyzing_at,finalizing_at FROM apuracoes_flow WHERE competence_period=?1 AND store_id IN (${q})`).bind(period,...ids).all();
    flows=r.results||[];
  }catch(error){
    console.error('Apurações flow read:',error?.message||error);
  }

  const em=new Map(executions.map(x=>[`${x.store_id}|${x.obligation}`,x]));
  const fm=new Map(flows.map(x=>[`${x.store_id}|${x.obligation}`,x]));
  const items=[];
  for(const s of stores){
    for(const obligation of TAXES){
      const e=em.get(`${s.id}|${obligation}`)||{};
      const f=fm.get(`${s.id}|${obligation}`)||{};
      let status=e.status||'Pendente';
      if(f.phase==='Query'||f.phase==='Analisando')status='Analisando';
      else if(f.phase==='Finalizando')status='Finalizado';
      else if(f.phase==='Gerando')status='Gerando';
      items.push({id:s.id,store_id:s.id,number:s.number,name:s.name,state:s.state,analyst:s.analyst||'',obligation,status,started_at:e.started_at||null,analyzing_at:e.analyzing_at||null,finished_at:e.finished_at||null,updated_at:e.updated_at||null,flow_phase:f.phase||null,query_generated_at:f.query_generated_at||null,flow_analyzing_at:f.flow_analyzing_at||null,finalizing_at:f.finalizing_at||null});
    }
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