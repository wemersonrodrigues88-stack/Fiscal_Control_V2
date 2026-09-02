(function(){
const originalFetch=window.fetch.bind(window);
let timer;
const token=()=>sessionStorage.getItem('fiscal_token')||'';
const TAX=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
async function sync(){
  if(document.querySelector('#page-title')?.textContent.trim()!=='Dashboard')return;
  try{
    const r=await originalFetch('/api/apuracoes',{headers:{Authorization:`Bearer ${token()}`}});
    if(!r.ok)return;
    const d=await r.clone().json();
    const items=d.items||[];
    const cards=document.querySelectorAll('.kpis .kpi');
    if(cards.length<4)return;
    const finalizadas=items.filter(x=>x.status==='Finalizado').length;
    const andamento=items.filter(x=>['Gerando','Analisando'].includes(x.status)).length;
    const pendentes=items.filter(x=>x.status==='Pendente').length;
    [finalizadas,andamento,pendentes].forEach((v,i)=>{const el=cards[i+1]?.querySelector('.value');if(el)el.textContent=String(v)});
    const obligations=document.querySelector('.section.card');
    if(obligations){
      const rows=[...obligations.querySelectorAll('.metric')];
      rows.forEach((row,i)=>{if(!TAX[i])return;const done=items.filter(x=>x.obligation===TAX[i]&&x.status==='Finalizado').length;const total=new Set(items.filter(x=>x.obligation===TAX[i]).map(x=>x.store_id)).size||0;const b=row.querySelector('b');if(b)b.textContent=`${done}/${total}`;const progress=row.nextElementSibling?.querySelector('i');if(progress)progress.style.width=`${total?done/total*100:0}%`});
    }
    cards.forEach((card,i)=>{if(i===0)return;card.dataset.dashboardStatus=['','Finalizado','Em andamento','Pendente'][i]||'';card.setAttribute('role','button');card.style.cursor='pointer'});
  }catch{}
}
function start(){clearInterval(timer);sync();timer=setInterval(sync,3000)}
document.addEventListener('click',e=>{const card=e.target.closest('.kpis .kpi');if(!card||!card.dataset.dashboardStatus)return;const b=document.querySelector('[data-page="apuracoes"]');if(b)b.click()});
new MutationObserver(()=>{if(document.querySelector('#page-title')?.textContent.trim()==='Dashboard')setTimeout(start,50)}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(start,500);
})();