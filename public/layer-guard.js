(()=>{
  // Proteção interna contra re-renderizações em cascata causadas por observers globais.
  // Não altera HTML, CSS, layout, rotas ou funções do sistema.
  const NativeMutationObserver=window.MutationObserver;
  if(!NativeMutationObserver||window.__FISCAL_LAYER_GUARD__)return;
  window.__FISCAL_LAYER_GUARD__=true;
  window.MutationObserver=class extends NativeMutationObserver{
    constructor(callback){
      let lastPageTitle=document.querySelector('#page-title')?.textContent.trim()||'';
      super(records=>{
        const currentPageTitle=document.querySelector('#page-title')?.textContent.trim()||'';
        if(currentPageTitle!==lastPageTitle){
          lastPageTitle=currentPageTitle;
          callback(records,this);
        }
      });
    }
  };
})();
