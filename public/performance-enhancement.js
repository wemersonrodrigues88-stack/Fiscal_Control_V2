(()=>{
  const originalFetch=window.fetch.bind(window);
  const cache=new Map();
  const TTL={
    '/api/state':5000,
    '/api/team':30000,
    '/api/team/options':30000,
    '/api/portfolios':30000
  };
  const keyFor=(url,headers)=>{
    const token=headers?.Authorization||'';
    return `${url}::${token}`;
  };
  const apuracoesFallback=async(init,originalError)=>{
    try{
      const fallback=await originalFetch('/api/state',{method:'GET',headers:init?.headers||{}});
      if(!fallback.ok)return null;
      const data=await fallback.json().catch(()=>null);
      if(!data)return null;
      const stores=data.stores||[];
      const executions=data.executions||[];
      const items=[];
      for(const store of stores){
        for(const obligation of (data.obligations||['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'])){
          const execution=executions.find(x=>String(x.store_id)===String(store.id)&&x.obligation===obligation);
          items.push({...store,...(execution||{store_id:store.id,obligation,status:'Pendente',started_at:null,analyzing_at:null,finished_at:null})});
        }
      }
      return new Response(JSON.stringify({stores,items,checklist:[],fallback:true}),{status:200,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store','x-apuracoes-fallback':'state'}});
    }catch{return null}
  };
  window.fetch=async(input,init={})=>{
    const method=String(init?.method||'GET').toUpperCase();
    const url=typeof input==='string'?input:(input?.url||'');
    const headers=init?.headers||{};
    if(method==='GET'){
      const path=new URL(url,location.href).pathname;
      if(path==='/api/apuracoes'){
        try{
          const response=await originalFetch(input,init);
          if(response.ok)return response;
          const fallback=await apuracoesFallback(init,response);
          return fallback||response;
        }catch(error){
          const fallback=await apuracoesFallback(init,error);
          if(fallback)return fallback;
          throw error;
        }
      }
    }
    if(method!=='GET'){
      cache.clear();
      return originalFetch(input,init);
    }
    const path=new URL(url,location.href).pathname;
    const ttl=TTL[path];
    if(!ttl)return originalFetch(input,init);
    const key=keyFor(path,headers);
    const hit=cache.get(key);
    const now=Date.now();
    if(hit&&now-hit.time<ttl)return hit.response.clone();
    const response=await originalFetch(input,init);
    if(response.ok)cache.set(key,{time:now,response:response.clone()});
    return response;
  };
  window.addEventListener('pagehide',()=>cache.clear());
})();
