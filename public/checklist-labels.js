// Checklist ICMS — rótulos oficiais.
// O checklist possui 8 itens e os rótulos devem permanecer sincronizados com o fluxo.
(function(){
  const apply=()=>{
    document.querySelectorAll('.check-row b').forEach(el=>{
      const t=el.textContent.trim();
      if(/^7\./.test(t)) el.textContent='7. Controle Fechado';
      if(/^8\./.test(t)) el.textContent='8. Contabilização';
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
})();
