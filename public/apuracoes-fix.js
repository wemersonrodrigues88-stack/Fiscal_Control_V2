(()=>{
  const nativeFetch=window.fetch.bind(window);
  const TAXES=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
  const headersFrom=init=>new Headers(init?.headers||{});
  const fallback=async init=>{
    const headers=headersFrom(init);
    const r=await nativeFetch('/api/state?apuracoes_fallback=1',{method:'GET',headers,cache:'no-store'});
    if(!r.ok) return null;
    const d=await r.json();
    const stores=Array.isArray(d.stores)?d.stores:[];
    const executions=Array.isArray(d.executions)?d.executions:[];
    const items=[];
    for(const s of stores){
      for(const obligation of TAXES){
        const e=executions.find(x=>String(x.store_id)===String(s.id)&&x.obligation===obligation);
        items.push({...s,...(e||{store_id:s.id,obligation,status:'Pendente',started_at:null,analyzing_at:null,finished_at:null,updated_at:null})});
      }
    }
    return new Response(JSON.stringify({stores,items,checklist:[],fallback:true}),{status:200,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store','x-apuracoes-fallback':'state'}});
  };
  window.fetch=async(input,init={})=>{
    const method=String(init?.method||'GET').toUpperCase();
    const url=typeof input==='string'?input:(input?.url||'');
    let path='';
    try{path=new URL(url,location.href).pathname}catch{}
    if(method==='GET'&&path==='/api/apuracoes'){
      try{
        const r=await nativeFetch(input,{...init,cache:'no-store'});
        if(r.ok)return r;
        const f=await fallback(init);
        if(f)return f;
        return r;
      }catch(error){
        const f=await fallback(init);
        if(f)return f;
        throw error;
      }
    }
    return nativeFetch(input,init);
  };
})();
