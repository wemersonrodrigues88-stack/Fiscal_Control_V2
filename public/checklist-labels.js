// Ajuste visual isolado: mantém as chaves internas e altera somente o texto exibido.
(function(){
  const TARGET='7. Contabilização';
  const REPLACEMENT='7. Controle Fechado';
  function apply(){
    document.querySelectorAll('.check-row b').forEach(el=>{
      if(el.textContent.trim()===TARGET) el.textContent=REPLACEMENT;
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
})();
