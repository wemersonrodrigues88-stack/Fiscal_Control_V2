(function(){
  function isCarteiras(){
    return window.state?.page==='carteiras' || document.querySelector('#page-title')?.textContent.trim()==='Carteiras';
  }

  function clean(){
    if(!isCarteiras()) return;
    const content=document.querySelector('#content');
    if(!content) return;

    content.querySelectorAll('.section-title').forEach(section=>{
      const h2=section.querySelector('h2');
      if(h2?.textContent.trim()==='Carteiras') section.remove();
    });
  }

  new MutationObserver(()=>setTimeout(clean,0)).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(clean,0);
})();
