(function(){
  function apply(){
    const dashboardButton=document.querySelector('[data-page="dashboard"]');
    if(dashboardButton) dashboardButton.textContent='Geral';

    const title=document.querySelector('#page-title');
    const isDashboard=title?.textContent.trim()==='Acompanhamento Mensal de Execuções e Prazos';
    if(!isDashboard) return;

    const content=document.querySelector('#content');
    if(!content) return;

    content.querySelectorAll('.kpi').forEach(card=>{
      const label=card.querySelector('.label')?.textContent.trim();
      if(label==='Analistas ativos' || label==='Pendentes') card.remove();
    });

    content.querySelectorAll('.section-title .muted').forEach(el=>{
      if(el.textContent.trim()==='Acompanhamento online e centralizado da operação fiscal.') el.remove();
    });

    content.querySelectorAll('.grid.two > .card').forEach(card=>{
      if(card.querySelector('.title h3')?.textContent.trim()==='Analistas') card.remove();
    });
  }

  new MutationObserver(()=>setTimeout(apply,0)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="dashboard"]'))setTimeout(apply,50)});
  setTimeout(apply,100);
})();
