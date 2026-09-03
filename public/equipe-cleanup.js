(function(){
  function isEquipe(){
    return window.state?.page==='equipe' || document.querySelector('#page-title')?.textContent.trim()==='Equipe';
  }

  function clean(){
    if(!isEquipe()) return;
    const content=document.querySelector('#content');
    if(!content) return;

    content.querySelectorAll('.section-title .muted').forEach(el=>{
      if(el.textContent.trim()==='Todos os colaboradores autorizados para o seu nível de acesso.'){
        el.remove();
      }
    });

    const table=content.querySelector('.table-wrap');
    const candidates=[...content.querySelectorAll('div,section,fieldset')];
    candidates.forEach(el=>{
      if(table && (el===table || table.contains(el))) return;
      const text=el.textContent.replace(/\s+/g,' ').trim();
      const hasSelect=!!el.querySelector('select');
      const isFilter=text.includes('Senioridade') && text.includes('Coordenador') && hasSelect;
      if(isFilter && el.children.length<=4) el.remove();
    });
  }

  new MutationObserver(()=>setTimeout(clean,0)).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(clean,0);
})();
