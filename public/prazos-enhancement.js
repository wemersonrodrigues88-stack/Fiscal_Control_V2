/* Prazos — ISS: apresentação por município, com vencimento ao lado.
   Mantém a fonte de dados existente (/api/state e /api/iss-deadlines).
   Para Analista/Assistente, exibe somente as cidades da própria carteira.
   Para Gestão/Coordenador/Desenvolvedor, permite editar o dia salvo. */
(function(){
  'use strict';

  const MANAGEMENT = ['Gestão','Coordenador','Desenvolvedor'];

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  function api(path, options){
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = sessionStorage.getItem('fiscal_token');
    if(token) headers.Authorization = 'Bearer ' + token;
    if(opts.body && !headers['content-type']) headers['content-type'] = 'application/json';

    return fetch(path, Object.assign({}, opts, {headers:headers})).then(function(response){
      return response.json().catch(function(){ return {}; }).then(function(data){
        if(!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }

  function cityRows(data, uf){
    const stores = Array.isArray(data.stores) ? data.stores : [];
    const configured = new Map(
      (Array.isArray(data.iss_deadlines) ? data.iss_deadlines : [])
        .filter(function(item){
          return String(item.state || '').trim().toUpperCase() === uf;
        })
        .map(function(item){
          return [String(item.city || '').trim().toUpperCase(), item];
        })
    );

    const cities = new Map();
    stores.forEach(function(store){
      if(String(store.state || '').trim().toUpperCase() !== uf) return;
      const city = String(store.city || '').trim();
      if(!city) return;
      const key = city.toUpperCase();
      if(!cities.has(key)) cities.set(key, city);
    });

    return Array.from(cities.values())
      .sort(function(a,b){ return a.localeCompare(b,'pt-BR'); })
      .map(function(city){
        const saved = configured.get(city.toUpperCase());
        return {city:city, due_day:saved && saved.due_day != null ? saved.due_day : null};
      });
  }

  function openIss(uf){
    api('/api/state').then(function(data){
      const profile = data && data.user && data.user.profile ? data.user.profile : '';
      const canEdit = MANAGEMENT.indexOf(profile) >= 0;
      const rows = cityRows(data, uf);

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML =
        '<div class="iss-modal-card">' +
          '<div class="iss-modal-head">' +
            '<div><h3>ISS — ' + esc(uf) + '</h3>' +
            '<p>Vencimentos dos municípios cadastrados nas carteiras.</p></div>' +
            '<button type="button" class="iss-close">Fechar</button>' +
          '</div>' +
          '<div class="iss-modal-info">' +
            (canEdit
              ? 'Informe o dia de vencimento ao lado de cada município e salve. A lista é baseada nas cidades cadastradas em Carteiras.'
              : 'Consulta dos vencimentos de ISS das cidades das lojas da sua carteira.') +
          '</div>' +
          '<div class="iss-city-table">' +
            '<div class="iss-city-row iss-city-header"><span>Município</span><span>Vencimento</span></div>' +
            (rows.length
              ? rows.map(function(row){
                  if(canEdit){
                    return '<div class="iss-city-row">' +
                      '<div><strong>' + esc(row.city) + '</strong></div>' +
                      '<div class="iss-city-action">' +
                        '<input class="iss-day-input" data-city="' + esc(row.city) + '" type="number" min="1" max="31" step="1" value="' + esc(row.due_day ?? '') + '" placeholder="Dia">' +
                        '<button type="button" class="primary iss-save-day" data-city="' + esc(row.city) + '">Salvar</button>' +
                      '</div>' +
                    '</div>';
                  }
                  return '<div class="iss-city-row">' +
                    '<div><strong>' + esc(row.city) + '</strong></div>' +
                    '<div class="iss-saved-day">' + (row.due_day ? 'Dia ' + esc(row.due_day) : 'Não informado') + '</div>' +
                  '</div>';
                }).join('')
              : '<div class="iss-empty">Nenhum município das lojas desta carteira está cadastrado para este estado.</div>') +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      const style = document.createElement('style');
      style.dataset.issEnhancement = '1';
      style.textContent =
        '.iss-modal-card{max-width:760px;width:92%;max-height:82vh;overflow:auto;background:#fff;border:1px solid #dbe3ef;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.22);padding:22px}' +
        '.iss-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:16px;border-bottom:1px solid #e7edf5}' +
        '.iss-modal-head h3{margin:0 0 5px;font-size:20px;color:#10233f}' +
        '.iss-modal-head p{margin:0;color:#64748b;font-size:14px}' +
        '.iss-modal-head .iss-close{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 14px;color:#17346f;cursor:pointer}' +
        '.iss-modal-info{margin:16px 0;padding:12px 14px;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:10px;color:#52627a;font-size:13px;line-height:1.45}' +
        '.iss-city-table{border:1px solid #e1e8f1;border-radius:12px;overflow:hidden}' +
        '.iss-city-row{min-height:58px;display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:18px;align-items:center;padding:10px 16px;border-top:1px solid #e8edf4}' +
        '.iss-city-header{border-top:0;background:#f7f9fc;min-height:44px;font-size:12px;font-weight:700;color:#52627a;text-transform:uppercase;letter-spacing:.02em}' +
        '.iss-city-action{display:flex;align-items:center;justify-content:flex-end;gap:8px}' +
        '.iss-day-input{width:88px;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:14px;color:#0f172a;background:#fff}' +
        '.iss-save-day{height:38px;padding:0 15px;border:0;border-radius:8px;cursor:pointer}' +
        '.iss-saved-day{justify-self:end;min-width:100px;text-align:center;font-weight:700;color:#17346f;background:#edf3ff;border-radius:8px;padding:9px 12px}' +
        '.iss-empty{padding:28px 18px;text-align:center;color:#64748b}' +
        '@media(max-width:620px){.iss-city-row{grid-template-columns:1fr}.iss-city-action{justify-content:flex-start}.iss-saved-day{justify-self:start}}';
      document.head.appendChild(style);

      modal.querySelector('.iss-close').onclick = function(){ modal.remove(); };
      modal.addEventListener('click', function(event){
        if(event.target === modal) modal.remove();
      });

      modal.querySelectorAll('.iss-save-day').forEach(function(button){
        button.onclick = function(){
          const input = modal.querySelector('.iss-day-input[data-city="' + CSS.escape(button.dataset.city) + '"]');
          const raw = input ? input.value.trim() : '';
          const day = raw === '' ? null : Number(raw);

          if(day !== null && (!Number.isInteger(day) || day < 1 || day > 31)){
            input.setCustomValidity('Informe um dia inteiro entre 1 e 31.');
            input.reportValidity();
            input.focus();
            return;
          }

          input.setCustomValidity('');
          button.disabled = true;
          button.textContent = 'Salvando...';

          api('/api/iss-deadlines',{
            method:'PUT',
            body:JSON.stringify({state:uf,city:button.dataset.city,due_day:day})
          }).then(function(){
            button.textContent = 'Salvo';
            input.value = day ?? '';
            setTimeout(function(){ button.textContent = 'Salvar'; },700);
          }).catch(function(error){
            alert(error.message);
            button.textContent = 'Salvar';
          }).finally(function(){
            button.disabled = false;
          });
        };
      });
    }).catch(function(error){
      alert(error.message);
    });
  }

  document.addEventListener('click', function(event){
    const button = event.target.closest && event.target.closest('.iss-open');
    if(!button) return;
    event.preventDefault();
    event.stopPropagation();
    openIss(String(button.dataset.state || '').trim().toUpperCase());
  }, true);
})();