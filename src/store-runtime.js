async function isolateSharedStorePortfolios(env) {
  const stores = await env.DB.prepare(`
    SELECT s.id,s.code,s.name,s.status,ps.portfolio_id,p.owner_user_id
    FROM stores s
    LEFT JOIN portfolio_stores ps ON ps.store_id=s.id
    LEFT JOIN portfolios p ON p.id=ps.portfolio_id
    WHERE s.status='active'
    ORDER BY CAST(s.code AS INTEGER), s.code, s.id
  `).all();
  const rows = stores.results || [];
  const byStore = new Map();
  for (const row of rows) {
    if (!byStore.has(row.id)) byStore.set(row.id, { ...row, links: [] });
    if (row.portfolio_id) byStore.get(row.id).links.push({ portfolio_id: row.portfolio_id, owner_user_id: row.owner_user_id });
  }
  for (const store of byStore.values()) {
    if (store.links.length === 1) {
      const portfolioId = store.links[0].portfolio_id;
      const shared = await env.DB.prepare('SELECT COUNT(*) AS total FROM portfolio_stores WHERE portfolio_id=?1').bind(portfolioId).first();
      if (Number(shared?.total || 0) === 1) continue;
    }
    const currentOwner = store.links[0]?.owner_user_id || null;
    const portfolioName = `Loja ${store.code} - ${store.name} [${store.id}]`;
    let portfolio = await env.DB.prepare('SELECT id,owner_user_id FROM portfolios WHERE name=?1').bind(portfolioName).first();
    let portfolioId = portfolio?.id;
    if (!portfolioId) {
      const inserted = await env.DB.prepare('INSERT INTO portfolios(name,description,owner_user_id) VALUES(?1,?2,?3)')
        .bind(portfolioName, 'Carteira exclusiva da loja', currentOwner).run();
      portfolioId = inserted.meta?.last_row_id;
    }
    if (!portfolioId) continue;
    await env.DB.prepare('DELETE FROM portfolio_stores WHERE store_id=?1').bind(store.id).run();
    await env.DB.prepare('INSERT OR IGNORE INTO portfolio_stores(portfolio_id,store_id) VALUES(?1,?2)').bind(portfolioId, store.id).run();
    if (currentOwner) {
      await env.DB.prepare('UPDATE portfolios SET owner_user_id=?1 WHERE id=?2').bind(currentOwner, portfolioId).run();
      await env.DB.prepare('INSERT OR IGNORE INTO analyst_portfolios(analyst_user_id,portfolio_id) VALUES(?1,?2)').bind(currentOwner, portfolioId).run();
    }
  }
}

export async function prepareStoreRuntime(env) {
  await isolateSharedStorePortfolios(env);
}

export function sortStorePayload(payload) {
  if (payload?.data && Array.isArray(payload.data)) {
    payload.data.sort((a,b) => {
      const na = Number(String(a.number ?? '').replace(/\D/g,''));
      const nb = Number(String(b.number ?? '').replace(/\D/g,''));
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.number ?? '').localeCompare(String(b.number ?? ''), 'pt-BR', { numeric: true });
    });
  }
  if (Array.isArray(payload?.stores)) {
    payload.stores.sort((a,b) => {
      const na = Number(String(a.number ?? '').replace(/\D/g,''));
      const nb = Number(String(b.number ?? '').replace(/\D/g,''));
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.number ?? '').localeCompare(String(b.number ?? ''), 'pt-BR', { numeric: true });
    });
  }
  return payload;
}
