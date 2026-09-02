(function(){
const originalFetch=window.fetch.bind(window);
let timer;
async function sync(){
  if(document.querySelector('#page-title')?.textContent.trim()!=='Dashboard')return;
  try{
    const r=await originalFetch('/api/apuracoes');
    if(!r.ok)return;
    const d=await r.clone().json();
    const items=d.items||[];
    const cards=document.querySelectorAll('.kpis .kpi');
    if(cards.length<4)return;
    const finalizadas=items.filter(x=>x.status==='Finalizado').length;
    const andamento=items.filter(x=>['Gerando','Analisando'].includes(x.status)).length;
    const pendentes=items.filter(x=>x.status==='Pendente').length;
    const vals=[finalizadas,andamento,pendentes];
    vals.forEach((v,i)=>{const el=cards[i+1]?.querySelector('.value');if(el)el.textContent=String(v)});
    cards.forEach((card,i)=>{if(i===0)return;card.dataset.dashboardStatus=['','Finalizado','Em andamento','Pendente'][i]||'';card.setAttribute('role','button');card.style.cursor='pointer'});
  }catch{}
}
function start(){clearInterval(timer);sync();timer=setInterval(sync,3000)}
document.addEventListener('click',e=>{
  const card=e.target.closest('.kpis .kpi');
  if(!card||!card.dataset.dashboardStatus)return;
  const status=card.dataset.dashboardStatus;
  if(status==='Finalizado'||status==='Pendente'||status==='Em andamento'){
    const b=document.querySelector('[data-page="apuracoes"]');
    if(b)b.click();
  }
});
new MutationObserver(()=>{if(document.querySelector('#page-title')?.textContent.trim()==='Dashboard')setTimeout(start,50)}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(start,500);
})();