(()=>{
  // Proteção interna contra re-renderizações em cascata causadas por observers globais.
  // Permite a primeira renderização da Dashboard aprovada quando o conteúdo antigo
  // for inserido, mas bloqueia as mutações geradas pela própria camada aprovada.
  const NativeMutationObserver=window.MutationObserver;
  if(!NativeMutationObserver||window.__FISCAL_LAYER_GUARD__)return;
  window.__FISCAL_LAYER_GUARD__=true;
  window.MutationObserver=class extends NativeMutationObserver{
    constructor(callback){
      let lastPageTitle=document.querySelector('#page-title')?.textContent.trim()||'';
      super(records=>{
        const currentPageTitle=document.querySelector('#page-title')?.textContent.trim()||'';
        const content=document.querySelector('#content');
        const dashboardNeedsRender=currentPageTitle==='Acompanhamento Mensal de Execuções e Prazos' && content && !content.querySelector('.fc-general');
        if(currentPageTitle!==lastPageTitle||dashboardNeedsRender){
          lastPageTitle=currentPageTitle;
          callback(records,this);
        }
      });
    }
  };
})();
