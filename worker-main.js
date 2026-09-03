import baseWorker from './status-flow-worker.js';

const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const GLOBAL_PROFILES=['Gestão','Gerente','Coordenador','Desenvolvedor'];
const PASSWORD_ITERATIONS=120000;
const CHALLENGE_TTL_MS=120000;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
function base64Url(bytes){let b='';for(const x of bytes)b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromBase64Url(value){const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-String(value||'').length%4)%4);const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return base64Url(new Uint8Array(d))}
async function auth(req,env){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))return null;const h=await sha(a.slice(7).trim());return env.DB.prepare(`SELECT u.id,u.name,p.name AS profile FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.id=u.profile_id WHERE s.token_hash=?1 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND u.status='active'`).bind(h).first()}
function parsePasswordHash(value){const parts=String(value||'').split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256')return null;const iterations=Number(parts[1]);if(!Number.isInteger(iterations)||iterations<100000||iterations>500000)return null;try{const salt=fromBase64Url(parts[2]);const derived=fromBase64Url(parts[3]);if(salt.length!==16||derived.length!==32)return null;return{iterations,salt,derived}}catch{return null}}
async function createSession(env,userId){const token=base64Url(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=await sha(token);const expiresAt=new Date(Date.now()+8*60*60*1000).toISOString();await env.DB.prepare('INSERT INTO sessions (user_id,token_hash,expires_at) VALUES (?1,?2,?3)').bind(userId,tokenHash,expiresAt).run();return token}
async function auditLogin(env,user,request){try{await env.DB.prepare(`INSERT INTO audit_log (user_id,request_id,method,path,action,entity_type,entity_id) VALUES (?1,?2,?3,?4,'login',NULL,NULL)`).bind(user?.id??null,crypto.randomUUID(),request.method,new URL(request.url).pathname).run()}catch(error){console.warn('Audit log skipped:',error?.message||error)}}
async function authChallenge(request,env){
  if(!env.DB)return json({error:'Serviço de autenticação indisponível.'},503);
  const body=await request.json().catch(()=>null);
  const username=String(body?.username||'').trim().toLowerCase();
  if(!username||username.length>120)return json({error:'Usuário ou senha inválidos.'},401);
  const row=await env.DB.prepare(`SELECT u.id,u.password_hash FROM users u WHERE u.username=?1 AND u.status='active' LIMIT 1`).bind(username).first();
  const parsed=parsePasswordHash(row?.password_hash);
  const userId=parsed?row.id:0;
  const salt=parsed?parsed.salt:crypto.getRandomValues(new Uint8Array(16));
  const iterations=parsed?parsed.iterations:PASSWORD_ITERATIONS;
  const payload=JSON.stringify({u:userId,e:Date.now()+CHALLENGE_TTL_MS,n:base64Url(crypto.getRandomValues(new Uint8Array(16)))});
  const payload64=base64Url(new TextEncoder().encode(payload));
  const signature=await sha(`${row?.password_hash||'invalid'}|${payload64}`);
  return json({challenge:`${payload64}.${signature}`,salt:base64Url(salt),iterations});
}
async function authLogin(request,env){
  if(!env.DB)return json({error:'Serviço de autenticação indisponível.'},503);
  const body=await request.json().catch(()=>null);
  const username=String(body?.username||'').trim().toLowerCase();
  const challenge=String(body?.challenge||'');
  const proof=String(body?.proof||'');
  if(!username||!challenge||!proof||challenge.length>500||proof.length>200)return json({error:'Usuário ou senha inválidos.'},401);
  const row=await env.DB.prepare(`SELECT u.id,u.username,u.name,u.status,u.password_hash,p.name AS profile FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.username=?1 AND u.status='active' LIMIT 1`).bind(username).first();
  if(!row||!parsePasswordHash(row.password_hash))return json({error:'Usuário ou senha inválidos.'},401);
  const parts=challenge.split('.');
  if(parts.length!==2)return json({error:'Usuário ou senha inválidos.'},401);
  let payload;
  try{payload=JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])))}catch{return json({error:'Usuário ou senha inválidos.'},401)}
  if(Number(payload?.u)!==Number(row.id)||!Number.isFinite(Number(payload?.e))||Number(payload.e)<=Date.now())return json({error:'Usuário ou senha inválidos.'},401);
  const expectedSignature=await sha(`${row.password_hash}|${parts[0]}`);
  if(expectedSignature!==parts[1])return json({error:'Usuário ou senha inválidos.'},401);
  let valid=false;
  try{
    const parsed=parsePasswordHash(row.password_hash);
    const key=await crypto.subtle.importKey('raw',parsed.derived,{name:'HMAC',hash:'SHA-256'},false,['verify']);
    valid=await crypto.subtle.verify('HMAC',key,fromBase64Url(proof),new TextEncoder().encode(challenge));
  }catch{valid=false}
  if(!valid)return json({error:'Usuário ou senha inválidos.'},401);
  try{await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP OR revoked_at IS NOT NULL').run()}catch(error){console.warn('Session cleanup skipped:',error?.message||error)}
  const token=await createSession(env,row.id);
  await auditLogin(env,row,request);
  return json({token,user:{id:row.id,username:row.username,name:row.name,profile:row.profile}});
}

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
      if(request.method==='POST'&&url.pathname==='/api/auth/challenge')return await authChallenge(request,env);
      if(request.method==='POST'&&url.pathname==='/api/auth/login')return await authLogin(request,env);
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