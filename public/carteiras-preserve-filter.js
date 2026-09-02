(()=>{
const KEY='fiscal_carteiras_return_filter';
const read=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null}};
const save=()=>{
  const state=document.querySelector('#car-state')?.value??'';
  const analyst=document.querySelector('#car-analyst')?.value??'';
  sessionStorage.setItem(KEY,JSON.stringify({state,analyst,pending:true}));
};
const apply=()=>{
  const saved=read();
  if(!saved?.pending)return false;
  const state=document.querySelector('#car-state');
  const analyst=document.querySelector('#car-analyst');
  if(!state||!analyst||state.options.length<2)return false;
  if([...state.options].some(o=>o.value===saved.state))state.value=saved.state;else state.value='';
  if([...analyst.options].some(o=>o.value===saved.analyst))analyst.value=saved.analyst;else analyst.value='';
  state.dispatchEvent(new Event('change',{bubbles:true}));
  sessionStorage.setItem(KEY,JSON.stringify({...saved,pending:false}));
  return true;
};
let timer;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>apply(),120);
}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{
  if(e.target.closest('.edit-store'))save();
},true);
setTimeout(apply,350);
})();