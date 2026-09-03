(function(){
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:input?.url||'';
      const method=(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
      if(method==='GET'&&new URL(url,location.href).pathname==='/api/apuracoes'){
        const headers=new Headers(init?.headers||(typeof input!=='string'?input.headers:undefined));
        const r=await originalFetch('/api/state',{method:'GET',headers});
        const d=await r.clone().json().catch(()=>null);
        if(r.ok&&d){
          const stores=d.stores||[], executions=d.executions||[], items=[];
          const taxes=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
          for(const s of stores)for(const tax of taxes){
            const x=executions.find(e=>String(e.store_id)===String(s.id)&&e.obligation===tax);
            items.push({...s,store_id:s.id,obligation:tax,status:x?.status||'Pendente',started_at:x?.started_at||null,analyzing_at:x?.analyzing_at||null,finished_at:x?.finished_at||null,updated_at:x?.updated_at||null});
          }
          return new Response(JSON.stringify({stores,items,checklist:[]}),{status:200,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}});
        }
        return r;
      }
    }catch(e){console.warn('Apurações fallback:',e)}
    return originalFetch(input,init);
  };
})();
