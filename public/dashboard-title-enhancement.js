(function(){
const TITLE='Acompanhamento Mensal de Execuções e Prazos';
function apply(){
  const title=document.querySelector('#page-title');
  if(title&&title.textContent.trim()==='Dashboard')title.textContent=TITLE;
  document.querySelectorAll('[data-page="dashboard"]').forEach(b=>{
    if(b.textContent.trim()==='Dashboard'||b.textContent.trim()===TITLE)b.textContent='Geral';
  });

  if(title?.textContent.trim()!==TITLE)return;
  const content=document.querySelector('#content');
  if(!content)return;

  content.querySelectorAll('.kpi').forEach(card=>{
    const label=card.querySelector('.label')?.textContent.trim();
    if(label==='Analistas ativos'||label==='Pendentes')card.remove();
  });

  content.querySelectorAll('.section-title .muted').forEach(el=>{
    if(el.textContent.trim()==='Acompanhamento online e centralizado da operação fiscal.')el.remove();
  });

  content.querySelectorAll('.grid.two > .card').forEach(card=>{
    if(card.querySelector('.title h3')?.textContent.trim()==='Analistas')card.remove();
  });
}
new MutationObserver(()=>setTimeout(apply,0)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(apply,0);
})();
