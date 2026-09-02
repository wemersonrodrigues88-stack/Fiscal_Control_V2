(()=>{
const LOCKED=['Ativo','Férias','Licença médica','Desligado','Pediu demissão'];
let repairing=false;
function isSituationSelect(s){return s?.id==='new-situation'||s?.name==='situation'}
function repair(root=document){if(repairing)return;const selects=[...root.querySelectorAll?.('select')||[]].filter(isSituationSelect);if(!selects.length)return;repairing=true;try{for(const s of selects){const current=s.value;const wanted=LOCKED.includes(current)?current:'Ativo';const html=LOCKED.map(v=>`<option value="${v}">${v}</option>`).join('');if(s.innerHTML!==html)s.innerHTML=html;s.value=wanted;s.setAttribute('data-situacao-protegida','true');s.required=true}}finally{repairing=false}}
const observer=new MutationObserver(()=>repair());observer.observe(document.documentElement,{childList:true,subtree:true});repair();
})();
