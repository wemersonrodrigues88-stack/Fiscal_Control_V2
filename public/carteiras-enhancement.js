(()=>{
const isPage=()=>document.querySelector('#page-title')?.textContent.trim()==='Carteiras';
function install(){
  if(document.getElementById('carteiras-final-style'))return;
  const s=document.createElement('style');
  s.id='carteiras-final-style';
  s.textContent=`.carteiras-print-page{display:none}@media print{ @page{size:A4 portrait;margin:5mm} body.print-carteiras{margin:0!important;background:#fff!important} body.print-carteiras .sidebar,body.print-carteiras .topbar,body.print-carteiras .section-title,body.print-carteiras .user-chip{display:none!important} body.print-carteiras .main{margin:0!important;padding:0!important;width:100%!important} body.print-carteiras #content{padding:0!important;margin:0!important} body.print-carteiras .table-wrap{overflow:visible!important;width:100%!important} body.print-carteiras table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:6.2pt!important;line-height:1.05!important} body.print-carteiras th,body.print-carteiras td{padding:2.2pt 2pt!important;border:1px solid #cbd5e1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important} body.print-carteiras th{font-size:6.3pt!important}}`;
  document.head.appendChild(s);
}
function setup(){
  if(!isPage())return;
  const c=document.querySelector('#content');
  if(!c)return;
  install();
  const subtitle=[...c.querySelectorAll('.section-title .muted')].find(x=>x.textContent.trim()==='Cadastro completo das lojas e vínculo com o analista.');
  subtitle?.remove();
  if(c.querySelector('#carteiras-print'))return;
  const header=c.querySelector('.section-title');
  if(!header)return;
  const b=document.createElement('button');
  b.id='carteiras-print';
  b.className='secondary';
  b.textContent='Imprimir';
  b.type='button';
  b.onclick=()=>{document.body.classList.add('print-carteiras');window.print();setTimeout(()=>document.body.classList.remove('print-carteiras'),700)};
  header.appendChild(b);
}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(setup,100)}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(setup,250);
document.addEventListener('click',e=>{if(e.target.closest('[data-page="carteiras"]'))setTimeout(setup,150)});
})();
