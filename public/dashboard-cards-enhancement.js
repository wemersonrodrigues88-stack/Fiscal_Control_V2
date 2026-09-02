(function(){
const originalFetch=window.fetch.bind(window);
let timer;
const token=()=>sessionStorage.getItem('fiscal_token')||'';
const TAX=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const norm=v=>String(v??'').trim().toUpperCase();
const itemTax=x=>x.obligation??x.tax??x.tax_name??x.name??'';
const itemStatus=x=>String(x.status??'').trim();
async function sync(){
  if(document.querySelector('#page-title')?.textContent.trim()!=='Dashboard')return;
  try{
    const r=await originalFetch('/api/apuracoes',{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'});
    if(!r.ok)return;
    const d=await r.clone().json();
    const items=d.items||[];
    const cards=document.querySelectorAll('.kpis .kpi');
    if(cards.length<4)return;
    const finalizadas=items.filter(x=>itemStatus(x)==='Finalizado').length;
    const andamento=items.filter(x=>['Gerando','Analisando'].includes(itemStatus(x))).length;
    const pendentes=items.filter(x=>itemStatus(x)==='Pendente').length;
    [finalizadas,andamento,pendentes].forEach((v,i)=>{const el=cards[i+1]?.querySelector('.value');if(el)el.textContent=String(v)});
    const obligations=[...document.querySelectorAll('.section.card')].find(el=>/Obrigações/i.test(el.textContent));
    if(obligations){
      const rows=[...obligations.querySelectorAll('.metric')];
      rows.forEach(row=>{
        const tax=TAX.find(t=>norm(row.textContent).startsWith(norm(t))||norm(row.textContent).includes(norm(t)));
        if(!tax)return;
        const taxItems=items.filter(x=>norm(itemTax(x))===norm(tax));
        const done=new Set(taxItems.filter(x=>itemStatus(x)==='Finalizado').map(x=>String(x.store_id??x.storeId??x.store??''))).size;
        const ids=new Set(taxItems.map(x=>String(x.store_id??x.storeId??x.store??'' )).filter(Boolean));
        const displayedTotal=(row.textContent.match(/\/\s*(\d+)/)||[])[1];
        const total=ids.size||Number(displayedTotal)||0;
        const count=row.querySelector('b,strong');
        if(count)count.textContent=`${done}/${total}`;
        const progress=row.querySelector('.progress i');
        if(progress)progress.style.width=`${total?Math.min(100,done/total*100):0}%`;
      });
    }
    cards.forEach((card,i)=>{if(i===0)return;card.dataset.dashboardStatus=['','Finalizado','Em andamento','Pendente'][i]||'';card.setAttribute('role','button');card.style.cursor='pointer'});
  }catch{}
}
function start(){clearInterval(timer);sync();timer=setInterval(sync,3000)}
document.addEventListener('click',e=>{const card=e.target.closest('.kpis .kpi');if(!card||!card.dataset.dashboardStatus)return;const b=document.querySelector('[data-page="apuracoes"]');if(b)b.click()});
new MutationObserver(()=>{if(document.querySelector('#page-title')?.textContent.trim()==='Dashboard')setTimeout(start,50)}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(start,500);
})();