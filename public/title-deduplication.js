(()=>{
  const pageTitle=()=>document.querySelector('#page-title')?.textContent.trim()||'';
  const clean=()=>{
    const title=pageTitle();
    if(!title)return;
    document.querySelectorAll('#content .section-title h2').forEach(h=>{
      if(h.textContent.trim()===title)h.remove();
    });
  };
  let timer;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(clean,0)};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
  document.addEventListener('click',e=>{if(e.target.closest('[data-page]'))schedule()});
})();
