import baseWorker from './status-flow-worker.js';

async function ensureApTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS execution_control(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id INTEGER NOT NULL,obligation TEXT NOT NULL,competence_period TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pendente',started_at TEXT,analyzing_at TEXT,finished_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by INTEGER,UNIQUE(store_id,obligation,competence_period))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS icms_checklist(id INTEGER PRIMARY KEY AUTOINCREMENT,store_id INTEGER NOT NULL,competence_period TEXT NOT NULL,item_key TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by INTEGER,UNIQUE(store_id,competence_period,item_key))`).run();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/api/apuracoes' || url.pathname === '/api/icms-checklist' || url.pathname === '/api/curva-abc-report')) {
      try {
        await env.DB.prepare('SELECT 1 FROM execution_control LIMIT 1').first();
        await env.DB.prepare('SELECT 1 FROM icms_checklist LIMIT 1').first();
      } catch {
        await ensureApTables(env);
      }
    }
    return baseWorker.fetch(request, env, ctx);
  }
};
