(()=>{
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
async function loadOptions(){
  const r=await fetch('/api/team-status',{headers:{'content-type':'application/json'}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||`Erro HTTP ${r.status}`);
  const team=d.data||[];
  return {
    coordinators:team.filter(x=>x.profile==='Coordenador'&&x.status==='active'),
    managers:team.filter(x=>['Gerente','Gestão'].includes(x.profile)&&x.status==='active')
  };
}
async function enhance(modal){
  if(!modal||modal.dataset.vinculosReady==='1')return;
  const coordinator=modal.querySelector('select[name="coordinator_user_id"]');
  const manager=modal.querySelector('select[name="manager_user_id"]');
  if(!coordinator||!manager)return;
  modal.dataset.vinculosReady='1';
  try{
    const currentCoordinator=coordinator.value;
    const currentManager=manager.value;
    const d=await loadOptions();
    coordinator.innerHTML='<option value="">Selecione</option>'+(d.coordinators||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    manager.innerHTML='<option value="">Selecione</option>'+(d.managers||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    if(currentCoordinator)coordinator.value=currentCoordinator;
    if(currentManager)manager.value=currentManager;
  }catch(e){
    modal.dataset.vinculosReady='0';
    console.error('Gestão: não foi possível carregar coordenadores/gerentes',e)
  }
}
const observer=new MutationObserver(()=>document.querySelectorAll('.gestao-modal').forEach(enhance));
observer.observe(document.body,{childList:true,subtree:true});
setTimeout(()=>document.querySelectorAll('.gestao-modal').forEach(enhance),300);
})();