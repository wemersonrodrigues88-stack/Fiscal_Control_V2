// Checklist ICMS — rótulos oficiais.
// Não remover nem renumerar itens: o checklist possui 8 itens.
(function(){
  const apply=()=>{
    document.querySelectorAll('.check-row b').forEach(el=>{
      const t=el.textContent.trim();
      if(t==='7. Contabilização') el.textContent='7. Controle Fechado';
      if(t==='8. Controle Fechado') el.textContent='8. Contabilização';
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
})();
