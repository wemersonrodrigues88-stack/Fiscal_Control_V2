(()=>{
  const setBusy=(b,v)=>{b.disabled=v;b.style.pointerEvents=v?'none':'auto'};
  let syncing=false;
  const syncButtons=()=>{
    if(syncing)return;
    syncing=true;
    try{
      document.querySelectorAll('.ap-action').forEach(b=>{
        const row=b.closest('.ap-row');
        const small=row?.querySelector('small');
        let status=(small?.textContent||'').replace(/^Status:\s*/i,'').trim();
        if(status==='Gerando'){
          if(small && small.textContent!=='Status: Gerando query')small.textContent='Status: Gerando query';
          status='Gerando';
        }
        const map={
          Pendente:['Gerar','Gerando'],
          Gerando:['Query geradas','Query geradas'],
          'Query geradas':['Analisar','Analisando'],
          Analisando:['Finalizar','Finalizado']
        };
        const next=map[status];
        if(next){
          if(b.textContent!==next[0])b.textContent=next[0];
          if(b.dataset.next!==next[1])b.dataset.next=next[1];
        }
      });
    }finally{syncing=false}
  };
  const action=async b=>{
    const id=Number(b.dataset.id),tax=b.dataset.tax,next=b.dataset.next;
    if(!id||!tax||!next)return;
    setBusy(b,true);
    try{
      await api('/api/apuracoes/status',{method:'PUT',body:JSON.stringify({store_id:id,obligation:tax,status:next})});
      document.querySelector('[data-page="apuracoes"]')?.click();
    }catch(e){alert(e.message);setBusy(b,false);syncButtons()}
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.ap-action');
    if(!b||b.disabled)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    action(b);
  },true);
  const observer=new MutationObserver(()=>{
    if(!syncing)queueMicrotask(syncButtons);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const style=document.createElement('style');
  style.textContent='.ap-action{position:relative;z-index:20;pointer-events:auto!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer}.ap-action:disabled{pointer-events:none!important}';
  document.head.appendChild(style);
  setTimeout(syncButtons,300);
})();
