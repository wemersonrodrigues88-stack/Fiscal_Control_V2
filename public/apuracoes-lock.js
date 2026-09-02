/* APURAÇÕES — LOCK PERMANENTE
   Esta trava protege a tela restaurada de Acompanhamento.
   O SHA abaixo é o Git blob SHA da versão autorizada de public/apuracoes-enhancement.js.
   Qualquer alteração no arquivo protegido faz a aplicação bloquear a tela, em vez de
   aceitar silenciosamente uma versão diferente.
*/
(function(){
  'use strict';
  const EXPECTED_GIT_BLOB_SHA='1484858f2489f9e830e458cc815ed2a02491f169';
  const SCRIPT='/apuracoes-enhancement.js?v=8';
  let checking=false;
  let blocked=false;

  function toHex(bytes){return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
  async function gitBlobSha(text){
    const body=new TextEncoder().encode(text);
    const head=new TextEncoder().encode(`blob ${body.length}\0`);
    const data=new Uint8Array(head.length+body.length);
    data.set(head);data.set(body,head.length);
    return toHex(await crypto.subtle.digest('SHA-1',data));
  }
  function locked(message){
    if(blocked)return;
    blocked=true;
    const c=document.querySelector('#content');
    if(!c)return;
    c.innerHTML=`<div class="card error" style="border:1px solid #f04438;padding:18px"><b>Apurações protegida</b><p>${message}</p><small>A versão autorizada da tela não foi alterada. Nenhuma versão diferente será executada.</small></div>`;
  }
  async function check(){
    if(checking||blocked)return;
    const title=document.querySelector('#page-title')?.textContent?.trim();
    if(title!=='Apurações')return;
    checking=true;
    try{
      const r=await fetch(`${SCRIPT}&lock=${EXPECTED_GIT_BLOB_SHA}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const text=await r.text();
      const actual=await gitBlobSha(text);
      if(actual!==EXPECTED_GIT_BLOB_SHA){
        locked('A tela de Acompanhamento está bloqueada porque o arquivo protegido foi alterado.');
        return;
      }
      const start=Date.now();
      while(Date.now()-start<4000){
        if(document.querySelector('#content .ap-table,#content .ap-grid,#content .checklist'))return;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(document.querySelector('#page-title')?.textContent?.trim()==='Apurações' && !document.querySelector('#content .ap-table,#content .ap-grid,#content .checklist')){
        locked('A versão autorizada foi carregada, mas a tela não foi inicializada corretamente. Nenhuma alteração automática foi aplicada.');
      }
    }catch(e){
      locked('Não foi possível validar a integridade da tela protegida.');
    }finally{checking=false}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="apuracoes"]'))setTimeout(check,350)});
  new MutationObserver(()=>{if(!blocked&&document.querySelector('#page-title')?.textContent?.trim()==='Apurações')setTimeout(check,150)}).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(check,500);
})();
