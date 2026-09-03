import statusWorker from './status-flow-worker-fixed.js';
import app from './worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}

async function getAp(req,env,ctx){
  const u=await auth(req,env);if(!u)return json({error:'Não autenticado.'},401);
  const upstream=await app.fetch(new Request(new URL('/api/state',req.url),{method:'GET',headers:req.headers}),env,ctx);
  if(!upstream.ok){
    const body=await upstream.text().catch(()=> '');
    const requestId=crypto.randomUUID();
    console.error('APURACOES_DIAGNOSTIC',JSON.stringify({requestId,status:upstream.status,body:body.slice(0,1000)}));
    return json({error:'Falha ao carregar os dados das Apurações.',diagnostic:{requestId,stage:'GET /api/apuracoes -> /api/state',httpStatus:upstream.status}},502);
  }
  let d;try{d=await upstream.json()}catch(error){const requestId=crypto.randomUUID();console.error('APURACOES_DIAGNOSTIC',JSON.stringify({requestId,stage:'GET /api/apuracoes -> parse JSON',error:error?.message||String(error)}));return json({error:'Resposta inválida da API de dados.',diagnostic:{requestId,stage:'parse JSON'}},502)}
  const stores=d.stores||[],executions=d.executions||[],map=new Map(executions.map(x=>[`${x.store_id}|${x.obligation}`,x]));
  const items=[];for(const s of stores)for(const tax of TAXES){const x=map.get(`${s.id}|${tax}`);items.push({...s,store_id:s.id,obligation:tax,status:x?.status||'Pendente',started_at:x?.started_at||null,analyzing_at:x?.analyzing_at||null,finished_at:x?.finished_at||null,updated_at:x?.updated_at||null})}
  return json({stores,items,checklist:[]});
}

export default {async fetch(request,env,ctx){const url=new URL(request.url);try{if(request.method==='GET'&&url.pathname==='/api/apuracoes')return getAp(request,env,ctx);return statusWorker.fetch(request,env,ctx)}catch(error){const requestId=crypto.randomUUID();console.error('APURACOES_DIAGNOSTIC',JSON.stringify({requestId,stage:`${request.method} ${url.pathname}`,error:error?.message||String(error)}));return json({error:error?.message||'Erro interno das Apurações.',diagnostic:{requestId,stage:`${request.method} ${url.pathname}`,type:error?.name||'Error'}},500)}}};
