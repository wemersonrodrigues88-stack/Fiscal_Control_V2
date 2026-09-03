(function(){
const TITLE='Acompanhamento Mensal de Execuções e Prazos';
function apply(){
  const title=document.querySelector('#page-title');
  if(title&&title.textContent.trim()==='Dashboard')title.textContent=TITLE;
  document.querySelectorAll('[data-page="dashboard"]').forEach(b=>{if(b.textContent.trim()==='Dashboard')b.textContent=TITLE});
}
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(apply,0);
})();
