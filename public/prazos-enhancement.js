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

  function setSavedState(card, saved){
    if(!card) return;
    const saveBtn = card.querySelector('.save-state-deadlines');
    const inputs = inputsFor(card);
    if(!saveBtn) return;

    if(saved){
      card.setAttribute(MARKER, 'true');
      inputs.forEach(input => { input.disabled = true; input.classList.add(LOCK_CLASS); });

      saveBtn.disabled = false;
      saveBtn.textContent = 'Prazo salvo';
      saveBtn.dataset.prazoSaved = 'true';
      saveBtn.classList.add('prazos-salvos');

      let editBtn = card.querySelector('.alterar-state-deadlines');
      if(!editBtn){
        editBtn = document.createElement('button');
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
      return;
    }

    card.removeAttribute(MARKER);
    inputs.forEach(input => { input.disabled = false; input.classList.remove(LOCK_CLASS); });
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar prazos ' + (card.dataset.state || '');
    saveBtn.dataset.prazoSaved = 'false';
    saveBtn.classList.remove('prazos-salvos');
    const editBtn = card.querySelector('.alterar-state-deadlines');
    if(editBtn) editBtn.remove();
  }

  function watchSaveButtons(){
    document.querySelectorAll('.save-state-deadlines').forEach(btn => {
      if(btn.dataset.prazoHooked === 'true') return;
      btn.dataset.prazoHooked = 'true';

      btn.addEventListener('click', function(){
        const card = btn.closest('.deadline-state-card');
        if(!card) return;

        window.setTimeout(function(){
          if(!btn.isConnected) return;
          if(btn.textContent.trim().toLowerCase().startsWith('salvar prazos')){
            setSavedState(card, true);
          }
        }, 1700);
      }, true);
    });
  }

  function init(){
    watchSaveButtons();

    const observer = new MutationObserver(function(){
      watchSaveButtons();
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();