// Deploy trigger v2: checklist ICMS com 8 itens, incluindo Contabilização; Curva ABC com 3 opções.
import baseWorker from './status-flow-worker-fixed.js';
import { handlePasswordReset } from './src/password-reset.js';
import { handleAuthRuntime } from './src/auth-runtime.js';
import { handleDeadlineRuntime } from './src/deadline-runtime.js';
import { handleTeamStatusRuntime } from './src/team-status-runtime.js';
import { prepareStoreRuntime, sortStorePayload } from './src/store-runtime.js';

const PASSWORD_ITERATIONS=120000;
const CHALLENGE_TTL_MS=120000;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}
function base64Url(bytes){let b='';for(const x of bytes)b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromBase64Url(value){const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-String(value||'').length%4)%4);const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return base64Url(new Uint8Array(d))}
function parsePasswordHash(value){const parts=String(value||'').split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256')return null;const iterations=Number(parts[1]);if(!Number.isInteger(iterations)||iterations<100000||iterations>500000)return null;try{const salt=fromBase64Url(parts[2]);const derived=fromBase64Url(parts[3]);if(salt.length!==16||derived.length!==32)return null;return{iterations,salt,derived}}catch{return null}}
async function createSession(env,userId){const token=base64Url(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=await sha(token);const expiresAt=new Date(Date.now()+8*60*60*1000).toISOString();await env.DB.prepare('INSERT INTO sessions (user_id,token_hash,expires_at) VALUES (?1,?2,?3)').bind(userId,tokenHash,expiresAt).run();return token}
async function auditLogin(env,user,request){try{await env.DB.prepare(`INSERT INTO audit_log (user_id,request_id,method,path,action,entity_type,entity_id) VALUES (?1,?2,?3,?4,'login',NULL,NULL)`).bind(user?.id??null,crypto.randomUUID(),request.method,new URL(request.url).pathname).run()}catch(error){console.warn('Audit log skipped:',error?.message||error)}}
async function authChallenge(request,env){if(!env.DB)return json({error:'Serviço de autenticação indisponível.'},503);const body=await request.json().catch(()=>null);const username=String(body?.username||'').trim().toLowerCase();if(!username||username.length>120)return json({error:'Usuário ou senha inválidos.'},401);const row=await env.DB.prepare(`SELECT u.id,u.password_hash FROM users u WHERE u.username=?1 AND u.status='active' LIMIT 1`).bind(username).first();const parsed=parsePasswordHash(row?.password_hash);const userId=parsed?row.id:0;const salt=parsed?parsed.salt:crypto.getRandomValues(new Uint8Array(16));const iterations=parsed?parsed.iterations:PASSWORD_ITERATIONS;const payload=JSON.stringify({u:userId,e:Date.now()+CHALLENGE_TTL_MS,n:base64Url(crypto.getRandomValues(new Uint8Array(16)))});const payload64=base64Url(new TextEncoder().encode(payload));const signature=await sha(`${row?.password_hash||'invalid'}|${payload64}`);return json({challenge:`${payload64}.${signature}`,salt:base64Url(salt),iterations})}
async function authLogin(request,env){if(!env.DB)return json({error:'Serviço de autenticação indisponível.'},503);const body=await request.json().catch(()=>null);const username=String(body?.username||'').trim().toLowerCase();const challenge=String(body?.challenge||'');const proof=String(body?.proof||'');if(!username||!challenge||!proof||challenge.length>500||proof.length>200)return json({error:'Usuário ou senha inválidos.'},401);const row=await env.DB.prepare(`SELECT u.id,u.username,u.name,u.status,u.password_hash,p.name AS profile FROM users u JOIN profiles p ON p.id=u.profile_id WHERE u.username=?1 AND u.status='active' LIMIT 1`).bind(username).first();if(!row||!parsePasswordHash(row.password_hash))return json({error:'Usuário ou senha inválidos.'},401);const parts=challenge.split('.');if(parts.length!==2)return json({error:'Usuário ou senha inválidos.'},401);let payload;try{payload=JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])))}catch{return json({error:'Usuário ou senha inválidos.'},401)}if(Number(payload?.u)!==Number(row.id)||!Number.isFinite(Number(payload?.e))||Number(payload.e)<=Date.now())return json({error:'Usuário ou senha inválidos.'},401);const expectedSignature=await sha(`${row.password_hash}|${parts[0]}`);if(expectedSignature!==parts[1])return json({error:'Usuário ou senha inválidos.'},401);let valid=false;try{const parsed=parsePasswordHash(row.password_hash);const key=await crypto.subtle.importKey('raw',parsed.derived,{name:'HMAC',hash:'SHA-256'},false,['verify']);valid=await crypto.subtle.verify('HMAC',key,fromBase64Url(proof),new TextEncoder().encode(challenge))}catch{valid=false}if(!valid)return json({error:'Usuário ou senha inválidos.'},401);try{await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP OR revoked_at IS NOT NULL').run()}catch(error){console.warn('Session cleanup skipped:',error?.message||error)}const token=await createSession(env,row.id);await auditLogin(env,row,request);return json({token,user:{id:row.id,username:row.username,name:row.name,profile:row.profile}})}
export default {async fetch(request,env,ctx){try{
  const resetResponse=await handlePasswordReset(request,env);
  if(resetResponse)return resetResponse;
  const authRuntimeResponse=await handleAuthRuntime(request,env);
  if(authRuntimeResponse)return authRuntimeResponse;
  const deadlineResponse=await handleDeadlineRuntime(request,env);
  if(deadlineResponse)return deadlineResponse;
  const teamStatusResponse=await handleTeamStatusRuntime(request,env);
  if(teamStatusResponse)return teamStatusResponse;
  const url=new URL(request.url);
  const isStoreWrite=request.method==='PUT'&&/^\/api\/stores\/\d+$/.test(url.pathname);
  const isStoreRead=request.method==='GET'&&(url.pathname==='/api/state'||url.pathname==='/api/stores');
  if(isStoreWrite)await prepareStoreRuntime(env);if(request.method==='POST'&&url.pathname==='/api/auth/challenge')return await authChallenge(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/login')return await authLogin(request,env);const response=await baseWorker.fetch(request,env,ctx);
  if(isStoreRead&&response.headers.get('content-type')?.includes('application/json')){
    const payload=await response.json();
    return new Response(JSON.stringify(sortStorePayload(payload)),{status:response.status,headers:{'content-type':'application/json; charset=UTF-8'}});
  }
  return response;
}catch(error){console.error('Worker request error:',error);return json({error:error?.message||'Erro interno do Worker.'},500)}}};
