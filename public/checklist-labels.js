// Checklist ICMS — rótulos oficiais.
// Os rótulos já são renderizados pelo app.js. Este ajuste apenas mantém a compatibilidade
// com renderizações futuras sem criar um loop de MutationObserver.
(function(){
  const apply=()=>{
    document.querySelectorAll('.check-row b').forEach(el=>{
      const t=el.textContent.trim();
      if(/^7\\./.test(t) && t!=='7. Controle Fechado') el.textContent='7. Controle Fechado';
      if(/^8\\./.test(t) && t!=='8. Contabilização') el.textContent='8. Contabilização';
    });
  };
  const start=()=>{
    apply();
    const observer=new MutationObserver(()=>apply());
    observer.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
