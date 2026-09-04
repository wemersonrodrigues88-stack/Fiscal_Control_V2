/* Prazos — estado salvo por UF.
   Regra: digitar -> Salvar prazos UF -> "Prazo salvo" fica visível.
   "Alterar prazo" libera novamente os campos daquela UF.
   Aplica-se a TODOS os estados exibidos, sem alterar a API/persistência.
*/
(function(){
  'use strict';

  const CARD = '.deadline-state-card';
  const INPUT = '.deadline-input';
  const SAVE = '.save-state-deadlines';
  const EDIT = '.alterar-state-deadlines';
  const SAVED = 'data-prazo-salvo';

  function inputs(card){
    return Array.from(card.querySelectorAll(INPUT));
  }

  function hasSavedValue(card){
    return inputs(card).some(input => String(input.value ?? '').trim() !== '');
  }

  function stateName(card){
    return String(card?.dataset?.state || '').trim().toUpperCase();
  }

  function restoreSaveButton(card){
    const btn = card?.querySelector(SAVE);
    if(!btn) return;
    const uf = stateName(card);
    btn.textContent = 'Salvar prazos ' + uf;
    btn.disabled = false;
    btn.dataset.prazoSaved = 'false';
    btn.classList.remove('prazos-salvos');
  }

  function addEditButton(card){
    const save = card?.querySelector(SAVE);
    if(!save || card.querySelector(EDIT)) return;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary alterar-state-deadlines';
    edit.textContent = 'Alterar prazo';
    edit.dataset.state = stateName(card);

    save.insertAdjacentElement('afterend', edit);

    edit.addEventListener('click', function(){
      inputs(card).forEach(input => {
        input.disabled = false;
        input.removeAttribute('data-saved-value');
      });

      card.removeAttribute(SAVED);
      restoreSaveButton(card);
      edit.remove();

      const first = inputs(card).find(input => !input.disabled);
      if(first) first.focus();
    });
  }

  function setSaved(card){
    const save = card?.querySelector(SAVE);
    if(!save) return;

    const uf = stateName(card);
    card.setAttribute(SAVED, 'true');

    inputs(card).forEach(input => {
      input.disabled = true;
      input.dataset.savedValue = input.value ?? '';
    });

    save.disabled = false;
    save.textContent = 'Prazo salvo';
    save.dataset.prazoSaved = 'true';
    save.classList.add('prazos-salvos');

    addEditButton(card);
  }

  function markExistingSavedStates(){
    document.querySelectorAll(CARD).forEach(card => {
      if(card.hasAttribute(SAVED)) return;
      if(hasSavedValue(card)) setSaved(card);
    });
  }

  function protectAutoSave(){
    /*
      O app original também possui salvamento por blur/change.
      Bloqueamos somente esses dois eventos nos campos de prazo para
      manter o fluxo solicitado: salvar exclusivamente pelo botão da UF.
    */
    document.addEventListener('change', function(event){
      if(event.target?.matches?.(INPUT)){
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('blur', function(event){
      if(event.target?.matches?.(INPUT)){
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function observeSaveConfirmation(){
    const observer = new MutationObserver(function(){
      document.querySelectorAll(CARD).forEach(card => {
        const save = card.querySelector(SAVE);
        if(!save) return;

        const text = save.textContent.trim().toLowerCase();
        if(text === 'prazos ' + stateName(card).toLowerCase() + ' salvos'){
          setSaved(card);
        }
      });

      markExistingSavedStates();
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function init(){
    protectAutoSave();
    observeSaveConfirmation();
    markExistingSavedStates();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();