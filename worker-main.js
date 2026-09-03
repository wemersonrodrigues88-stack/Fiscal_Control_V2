import baseWorker from './status-flow-worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const GLOBAL_PROFILES=['Gestão','Gerente','Coordenador','Desenvolvedor'];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}
async function readAp(req,env,u){
  const p=new Date().toISOString().slice(0,7);
  const all=await env.DB.prepare(`SELECT s.id,s.code AS number,s.name,s.state,COALESCE(u2.name,'') analyst FROM stores s LEFT JOIN portfolio_stores ps ON ps.store_id=s.id LEFT JOIN portfolios pf ON pf.id=ps.portfolio_id LEFT JOIN users u2 ON u2.id=pf.owner_user_id AND u2.status='active' WHERE s.status='active' GROUP BY s.id ORDER BY CAST(s.code AS INTEGER),s.code`).all();
  let stores=all.results||[];
  if(!GLOBAL_PROFILES.includes(u.profile))stores=stores.filter(s=>['Analista','Assistente'].includes(u.profile)&&s.analyst===u.name);
  if(!stores.length)return json({stores,items:[],checklist:[]});
  const ids=stores.map(s=>s.id),q=ids.map(()=>'?').join(',');
  let controls=[];
  try{const r=await env.DB.prepare(`SELECT store_id,obligation,status,started_at,analyzing_at,finished_at,updated_at FROM execution_control WHERE competence_period=?1 AND store_id IN (${q})`).bind(p,...ids).all();controls=r.results||[]}catch(e){console.error('Apurações execution_control read:',e?.message||e)}
  let checklist=[];
  try{const r=await env.DB.prepare(`SELECT store_id,item_key,status,updated_at FROM icms_checklist WHERE competence_period=?1 AND store_id IN (${q})`).bind(p,...ids).all();checklist=r.results||[]}catch(e){console.error('Apurações icms_checklist read:',e?.message||e)}
  let flows=[];
  try{const r=await env.DB.prepare(`SELECT store_id,obligation,phase,query_generated_at,analyzing_at,finalizing_at FROM apuracoes_flow WHERE competence_period=?1 AND store_id IN (${q})`).bind(p,...ids).all();flows=r.results||[]}catch(e){console.error('Apurações flow read:',e?.message||e)}
  const cm=new Map(controls.map(x=>[`${x.store_id}|${x.obligation}`,x]));
  const fm=new Map(flows.map(x=>[`${x.store_id}|${x.obligation}`,x]));
  const items=[];
  for(const s of stores)for(const tax of TAXES){
    const c=cm.get(`${s.id}|${tax}`)||{store_id:s.id,obligation:tax,status:'Pendente',started_at:null,analyzing_at:null,finished_at:null,updated_at:null};
    const f=fm.get(`${s.id}|${tax}`);
    const x={...s,...c};
    if(f){x.flow_phase=f.phase;x.query_generated_at=f.query_generated_at;x.flow_analyzing_at=f.analyzing_at;x.finalizing_at=f.finalizing_at;if(f.phase==='Query'||f.phase==='Analisando')x.status='Analisando';else if(f.phase==='Finalizando')x.status='Finalizado';else if(f.phase==='Gerando')x.status='Gerando'}
    items.push(x);
  }
  return json({stores,items,checklist});
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
