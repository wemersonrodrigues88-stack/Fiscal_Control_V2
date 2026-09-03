(function(){
const TITLE='Acompanhamento Mensal de Execuções e Prazos';
const TAX=['ICMS','PIS/COFINS','ISS','SPED ICMS','Fronteiras'];
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const dateBR=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString('pt-BR')};
function go(page){document.querySelector(`[data-page="${page}"]`)?.click()}
function monthLabel(){return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date()).replace(/^./,x=>x.toUpperCase())}
function status(x){const s=String(x.status||'').toLowerCase();if(s.includes('atras')||s.includes('venc'))return ['Atenção','red'];if(s.includes('andamento'))return ['Em andamento','blue'];if(s.includes('próx')||s.includes('proximo'))return ['Próximo','yellow'];return ['Em dia','green']}
function render(d){
  if(state.page!=='dashboard'||document.querySelector('#page-title')?.textContent.trim()!==TITLE)return;
  const c=document.querySelector('#content');if(!c)return;
  const stores=d.stores||state.data?.stores||[],items=d.items||[];
  const done=items.filter(x=>x.status==='Finalizado').length,running=items.filter(x=>['Gerando','Analisando'].includes(x.status)).length,total=stores.length*TAX.length;
  const deadlines=(state.data?.deadlines||[]).slice().sort((a,b)=>String(a.due_date||'').localeCompare(String(b.due_date||''))).slice(0,5);
  c.className='fc-general';
  c.innerHTML=`<div class="fc-competence"><span>Competência:</span><span>${monthLabel()}</span></div><div class="fc-kpis"><article><small>Lojas ativas</small><strong>${stores.length}</strong></article><article><small>Finalizadas</small><strong>${done} / ${total}</strong></article><article><small>Em andamento</small><strong>${running}</strong></article></div><div class="fc-columns"><section class="fc-card"><h2>Execução das obrigações</h2>${TAX.map(t=>{const a=items.filter(x=>(x.obligation||x.tax)===t),n=a.filter(x=>x.status==='Finalizado').length,p=stores.length?Math.round(n/stores.length*100):0;return `<div class="fc-tax"><b>${t}</b><i><u style="width:${p}%"></u></i><strong>${n}/${stores.length}</strong><span>${p}%</span></div>`}).join('')}<button class="fc-link" data-go="apuracoes">Ver todas as apurações ›</button></section><section class="fc-card"><h2>Prazos fiscais</h2><table><thead><tr><th>Data</th><th>Obrigação</th><th>Lojas</th><th>Situação</th></tr></thead><tbody>${deadlines.map(x=>{const [label,cl]=status(x);return `<tr><td>${esc(dateBR(x.due_date))}</td><td>${esc(x.obligation||x.name||'—')}</td><td>${stores.length}</td><td><span class="fc-status ${cl}">${label}</span></td></tr>`}).join('')||'<tr><td colspan="4">Nenhum prazo cadastrado.</td></tr>'}</tbody></table><button class="fc-link" data-go="prazos">Ver todos os prazos ›</button></section></div>`;
  c.querySelector('[data-go="apuracoes"]')?.addEventListener('click',()=>go('apuracoes'));
  c.querySelector('[data-go="prazos"]')?.addEventListener('click',()=>go('prazos'));
}
async function activate(){
  if(state.page!=='dashboard')return;
  const title=document.querySelector('#page-title');if(!title)return;
  const current=title.textContent.trim();if(current!=='Dashboard'&&current!==TITLE)return;
  title.textContent=TITLE;document.querySelector('[data-page="dashboard"]')?.replaceChildren(document.createTextNode('Geral'));
  try{const d=await api('/api/apuracoes');if(state.page!=='dashboard'||document.querySelector('#page-title')?.textContent.trim()!==TITLE)return;render(d)}catch{}
}
const style=document.createElement('style');style.textContent=`.fc-general{margin-top:-8px}.fc-competence{display:flex;gap:14px;margin:0 0 22px;font-size:16px}.fc-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}.fc-kpis article,.fc-card{background:#fff;border:1px solid #e1e7ef;border-radius:16px;padding:22px}.fc-kpis article{min-height:105px}.fc-kpis small{display:block;color:#687589;font-size:13px;margin-bottom:6px}.fc-kpis strong{font-size:30px}.fc-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fc-card h2{margin:0 0 20px;font-size:20px}.fc-tax{height:68px;display:grid;grid-template-columns:1fr 190px 55px 45px;align-items:center;gap:10px;border-bottom:1px solid #edf0f5}.fc-tax i{height:9px;background:#e9edf3;border-radius:99px;overflow:hidden}.fc-tax u{display:block;height:100%;background:#1769e0;border-radius:99px;text-decoration:none}.fc-tax strong,.fc-tax span:last-child{text-align:right;font-size:13px}.fc-link{display:block;margin:22px auto 0;background:none;border:0;color:#1769e0;font:inherit;cursor:pointer}.fc-card table{width:100%;border-collapse:collapse}.fc-card th,.fc-card td{padding:12px 7px;border-bottom:1px solid #edf0f5;text-align:left;font-size:13px;white-space:nowrap}.fc-card th{font-size:12px;color:#687589}.fc-card tr:last-child td{border-bottom:0}.fc-status{display:inline-block;padding:7px 10px;border-radius:9px;font-weight:700}.fc-status.green{background:#e5f7f0;color:#087453}.fc-status.yellow{background:#fff3d8;color:#966100}.fc-status.red{background:#ffe9e9;color:#c92f2f}.fc-status.blue{background:#eaf1ff;color:#1769e0}@media(max-width:900px){.fc-kpis,.fc-columns{grid-template-columns:1fr}.fc-tax{grid-template-columns:1fr 110px 45px 40px}}`;
document.head.appendChild(style);
new MutationObserver(()=>setTimeout(activate,20)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(activate,250);
})();