(()=>{
  const setBusy=(b,v)=>{b.disabled=v;b.style.pointerEvents=v?'none':'auto'};
  const action=async b=>{
    const id=Number(b.dataset.id),tax=b.dataset.tax,next=b.dataset.next;
    if(!id||!tax||!next)return;
    setBusy(b,true);
    try{
      if(next==='Analisando'){
        const status=b.textContent.trim();
        if(status==='Analisar'){
          try{
            await api('/api/apuracoes/status',{method:'PUT',body:JSON.stringify({store_id:id,obligation:tax,status:'Query geradas'})});
          }catch(e){
            if(!String(e.message||'').toLowerCase().includes('primeiro inicie'))throw e;
          }
        }
      }
      await api('/api/apuracoes/status',{method:'PUT',body:JSON.stringify({store_id:id,obligation:tax,status:next})});
      location.reload();
    }catch(e){alert(e.message);setBusy(b,false)}
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.ap-action');
    if(!b||b.disabled)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    action(b);
  },true);
  const style=document.createElement('style');
  style.textContent='.ap-action{position:relative;z-index:20;pointer-events:auto!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer}.ap-action:disabled{pointer-events:none!important}';
  document.head.appendChild(style);
})();
