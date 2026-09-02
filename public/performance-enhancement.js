(()=>{
  const originalFetch=window.fetch.bind(window);
  const cache=new Map();
  const inflight=new Map();
  const TTL={
    '/api/state':10000,
    '/api/team':30000,
    '/api/team/options':30000,
    '/api/team-status':30000,
    '/api/portfolios':30000,
    '/api/deadline-configs':30000,
    '/api/apuracoes':5000,
    '/api/apuracoes-report':10000,
    '/api/curva-abc-report':10000,
    '/api/dashboard':10000
  };
  const STALE={
    '/api/state':60000,
    '/api/team':120000,
    '/api/team/options':120000,
    '/api/team-status':120000,
    '/api/portfolios':120000,
    '/api/deadline-configs':120000,
    '/api/apuracoes':15000,
    '/api/apuracoes-report':30000,
    '/api/curva-abc-report':30000,
    '/api/dashboard':30000
  };
  const stateView=()=>{
    const title=document.querySelector('#page-title')?.textContent||'';
    const map={'Dashboard':'dashboard','Apurações':'apuracoes','Carteiras':'carteiras','Prazos':'prazos','Histórico':'historico','Equipe':'equipe','Gestão':'management'};
    return map[title]||'full';
  };
  const normalize=(input)=>{
    const raw=typeof input==='string'?input:(input?.url||'');
    const u=new URL(raw,location.href);
    if(u.pathname==='/api/state'&&!u.searchParams.has('view'))u.searchParams.set('view',stateView());
    return u;
  };
  const getHeader=(headers,name)=>{
    if(!headers)return '';
    if(typeof headers.get==='function')return headers.get(name)||'';
    return headers[name]||headers[name.toLowerCase()]||'';
  };
  const keyFor=(url,headers)=>`${url.toString()}::${getHeader(headers,'Authorization')}`;
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
    if(method!=='GET'){
      cache.clear();
      inflight.clear();
      return originalFetch(input,init);
    }
    const u=normalize(input),path=u.pathname,ttl=TTL[path];
    if(!ttl)return originalFetch(input,init);
    const headers=init?.headers||{};
    const key=keyFor(u,headers);
    const requestInput=typeof input==='string'?u.toString():new Request(u.toString(),input);
    const hit=cache.get(key),age=hit?Date.now()-hit.time:Infinity;
    if(hit&&age<ttl)return hit.response.clone();
    if(hit&&age<STALE[path]){
      fetchFresh(requestInput,init,key).catch(()=>{});
      return hit.response.clone();
    }
    return fetchFresh(requestInput,init,key);
  };
  window.addEventListener('pagehide',()=>{cache.clear();inflight.clear()});
})();
