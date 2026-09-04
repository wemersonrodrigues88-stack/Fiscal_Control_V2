/* Ajuste visual da tela Prazos:
   após salvar um estado, mantém "Prazo salvo" e disponibiliza "Alterar prazo".
   Não altera a API nem a persistência dos prazos. */
(function(){
  'use strict';

  const LOCK_CLASS = 'prazos-salvos-lock';
  const MARKER = 'data-prazo-salvo';

  function inputsFor(card){
    return Array.from(card.querySelectorAll('.deadline-input'));
  }

  function ensureSavedUi(card){
    if(!card) return;
    const saveBtn = card.querySelector('.save-state-deadlines');
    if(!saveBtn) return;

    const inputs = inputsFor(card);
    card.setAttribute(MARKER, 'true');
    inputs.forEach(input => {
      input.disabled = true;
      input.classList.add(LOCK_CLASS);
    });

    saveBtn.disabled = false;
    saveBtn.textContent = 'Prazo salvo';
    saveBtn.dataset.prazoSaved = 'true';
    saveBtn.classList.add('prazos-salvos');

    if(card.querySelector('.alterar-state-deadlines')) return;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary alterar-state-deadlines';
    editBtn.textContent = 'Alterar prazo';
    editBtn.dataset.state = card.dataset.state || '';
    saveBtn.insertAdjacentElement('afterend', editBtn);

    editBtn.addEventListener('click', function(){
      inputsFor(card).forEach(input => {
        input.disabled = false;
        input.classList.remove(LOCK_CLASS);
      });
      saveBtn.textContent = 'Salvar prazos ' + (card.dataset.state || '');
      saveBtn.dataset.prazoSaved = 'false';
      saveBtn.classList.remove('prazos-salvos');
      card.removeAttribute(MARKER);
      editBtn.remove();
    });
  }

  function watchButtons(){
    document.querySelectorAll('.save-state-deadlines').forEach(btn => {
      if(btn.dataset.prazoHooked === 'true') return;
      btn.dataset.prazoHooked = 'true';
    });
  }

  function init(){
    watchButtons();

    const observer = new MutationObserver(function(){
      watchButtons();
      document.querySelectorAll('.save-state-deadlines').forEach(btn => {
        const card = btn.closest('.deadline-state-card');
        if(!card) return;

        const text = btn.textContent.trim().toLowerCase();
        const state = (card.dataset.state || '').toLowerCase();

        if(text === ('prazos ' + state + ' salvos')){
          ensureSavedUi(card);
        }else if(card.getAttribute(MARKER) === 'true' && text === ('salvar prazos ' + state)){
          ensureSavedUi(card);
        }
      });
    });

    observer.observe(document.body, {childList:true, characterData:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();