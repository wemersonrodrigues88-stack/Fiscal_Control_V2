(()=>{
  const originalFetch=window.fetch.bind(window);
  const cache=new Map();
  const pending=new Map();
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
  window.fetch=async(input,init={})=>{
    const method=String(init?.method||'GET').toUpperCase();
    const url=typeof input==='string'?input:(input?.url||'');
    const headers=init?.headers||{};
    if(method!=='GET'){
      cache.clear();
      return originalFetch(input,init);
    }
    const path=new URL(url,location.href).pathname;
    const ttl=TTL[path];
    if(!ttl)return originalFetch(input,init);
    const key=keyFor(path,headers);
    const now=Date.now();
    const hit=cache.get(key);
    if(hit&&now-hit.time<ttl)return hit.response.clone();
    const running=pending.get(key);
    if(running){
      const response=await running;
      return response.clone();
    }
    const request=originalFetch(input,init).then(response=>{
      if(response.ok)cache.set(key,{time:Date.now(),response:response.clone()});
      return response;
    }).finally(()=>pending.delete(key));
    pending.set(key,request);
    return (await request).clone();
  };
  window.addEventListener('pagehide',()=>{cache.clear();pending.clear()});
})();
