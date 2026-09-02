(()=>{
  const originalFetch=window.fetch.bind(window);
  const cache=new Map();
  const inflight=new Map();
  const TTL={
    '/api/state':10000,
    '/api/team':30000,
    '/api/team/options':30000,
    '/api/portfolios':30000
  };
  const STALE={
    '/api/state':60000,
    '/api/team':120000,
    '/api/team/options':120000,
    '/api/portfolios':120000
  };
  const keyFor=(url,headers)=>{
    const token=headers?.Authorization||'';
    return `${url}::${token}`;
  };
  const fetchFresh=(input,init,key)=>{
    const existing=inflight.get(key);
    if(existing)return existing.then(r=>r.clone());
    const promise=originalFetch(input,init).then(response=>{
      if(response.ok)cache.set(key,{time:Date.now(),response:response.clone()});
      return response;
    }).finally(()=>inflight.delete(key));
    inflight.set(key,promise);
    return promise.then(r=>r.clone());
  };
  window.fetch=async(input,init={})=>{
    const method=String(init?.method||'GET').toUpperCase();
    const url=typeof input==='string'?input:(input?.url||'');
    const headers=init?.headers||{};
    if(method!=='GET'){
      cache.clear();
      inflight.clear();
      return originalFetch(input,init);
    }
    const path=new URL(url,location.href).pathname;
    const ttl=TTL[path];
    if(!ttl)return originalFetch(input,init);
    const key=keyFor(path,headers);
    const hit=cache.get(key);
    const age=hit?Date.now()-hit.time:Infinity;
    if(hit&&age<ttl)return hit.response.clone();
    if(hit&&age<STALE[path]){
      fetchFresh(input,init,key).catch(()=>{});
      return hit.response.clone();
    }
    return fetchFresh(input,init,key);
  };
  window.addEventListener('pagehide',()=>{cache.clear();inflight.clear()});
})();
