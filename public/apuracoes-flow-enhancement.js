(function(){
const phases=new Map();
const key=(id,tax)=>`${id}|${tax}`;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const secs=n=>{n=Math.max(0,Math.floor(Number(n)||0));const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h}h ${m}m ${s}s`:`${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`};
const elapsed=(a,b)=>a&&b?Math.max(0,(new Date(b)-new Date(a))/1000):0;
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
 const response=await originalFetch(input,init);
 try{
  const url=typeof input==='string'?input:(input?.url||'');
  if(new URL(url,location.href).pathname==='/api/apuracoes'&&response.ok){
   const clone=response.clone(),data=await clone.json();
   (data.items||[]).forEach(x=>{if(x.flow_phase)phases.set(key(x.store_id,x.obligation),x)});
  }
 }catch{}
 return response;
};
function apply(){
 document.querySelectorAll('.ap-action').forEach(b=>{
  const f=phases.get(key(b.dataset.id,b.dataset.tax));if(!f)return;
  const row=b.closest('.ap-row');
  if(f.flow_phase==='Gerando'){
   b.textContent='Gerando';
   if(row){const sm=row.querySelector('div>small');if(sm)sm.textContent='Status: Gerando'}
  }else if(f.flow_phase==='Query geradas'){
   b.textContent='Query geradas';
   if(row){const sm=row.querySelector('div>small');if(sm)sm.textContent='Status: Query geradas';let tm=row.querySelector('.timer');if(!tm){tm=document.createElement('small');tm.className='timer';b.parentElement.appendChild(tm)}tm.textContent=`Tempo de geração: ${secs(elapsed(f.started_at,f.query_generated_at))}`;tm.removeAttribute('data-t')}
  }else if(f.flow_phase==='Analisando'){
   b.textContent='Analisando';
   if(row){const sm=row.querySelector('div>small');if(sm)sm.textContent='Status: Analisando'}
  }
 });
 document.querySelectorAll('.ap-row').forEach(row=>{
  const b=row.querySelector('.ap-action');if(!b)return;const f=phases.get(key(b.dataset.id,b.dataset.tax));if(!f)return;
  if(f.flow_phase==='Finalizando'){b.textContent='Finalizando';if(row.querySelector('div>small'))row.querySelector('div>small').textContent='Status: Finalizando'}
 });
 document.querySelectorAll('.ap-table tbody tr').forEach(tr=>{
  const cells=[...tr.children].slice(2);
  cells.forEach(td=>{const badge=td.querySelector('.badge');if(!badge)return;const store=tr.dataset.s,tax=badge.parentElement?.querySelector('[data-tax]')?.dataset.tax;let f=null;if(tax)f=phases.get(key(store,tax));else{for(const [k,v] of phases){if(k.startsWith(`${store}|`)&&v.flow_phase===badge.textContent.trim()){f=v;break}}}if(!f)return;
   if(f.flow_phase==='Query geradas'){badge.textContent='Query geradas';badge.className='badge yellow';if(!td.querySelector('.flow-frozen')){const x=document.createElement('small');x.className='flow-frozen';x.textContent=`Tempo de geração: ${secs(elapsed(f.started_at,f.query_generated_at))}`;td.appendChild(x)}}
   if(f.flow_phase==='Analisando'){badge.textContent='Analisando';badge.className='badge blue'}
   if(f.flow_phase==='Finalizando'){badge.textContent='Finalizando';badge.className='badge green'}
  });
 });
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('.ap-action');if(!b)return;const f=phases.get(key(b.dataset.id,b.dataset.tax));if(!f||f.flow_phase!=='Query geradas')return;
 e.preventDefault();e.stopImmediatePropagation();b.disabled=true;
 try{
  const r=await originalFetch('/api/apuracoes/status',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${sessionStorage.getItem('fiscal_token')||''}`},body:JSON.stringify({store_id:Number(b.dataset.id),obligation:b.dataset.tax,status:'Analisando'})});
  if(!r.ok)throw new Error((await r.json()).error||'Não foi possível iniciar a análise.');
  const t=new Date().toISOString();f.flow_phase='Analisando';f.analyzing_at=t;b.disabled=false;apply();
 }catch(err){alert(err.message);b.disabled=false}
},true);
new MutationObserver(()=>setTimeout(apply,30)).observe(document.documentElement,{childList:true,subtree:true});
setInterval(apply,1000);setTimeout(apply,200);
})();
