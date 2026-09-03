(function(){
  function isPrazos(){
    return window.state?.page==='prazos' || document.querySelector('#page-title')?.textContent.trim()==='Prazos';
  }

  function clean(){
    if(!isPrazos()) return;
    const content=document.querySelector('#content');
    if(!content) return;

    content.querySelectorAll('.section-title .muted').forEach(el=>{
      if(el.textContent.trim()==='Consulte os prazos dos estados das suas lojas.'){
        el.remove();
      }
    });

    content.querySelectorAll('.deadline-note').forEach(el=>{
      if(el.textContent.replace(/\s+/g,' ').trim().startsWith('Regra: Gestão e Desenvolvedor administram os 4 estados.')){
        el.remove();
      }
    });
  }

  new MutationObserver(()=>setTimeout(clean,0)).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(clean,0);
})();
