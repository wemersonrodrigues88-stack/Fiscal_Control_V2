import baseWorker from './status-flow-worker.js';

const AP_SCHEMA = {
  execution_control: {
    store_id: 'INTEGER',
    obligation: 'TEXT',
    competence_period: 'TEXT',
    status: "TEXT NOT NULL DEFAULT 'Pendente'",
    started_at: 'TEXT',
    analyzing_at: 'TEXT',
    finished_at: 'TEXT',
    updated_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_by: 'INTEGER'
  },
  icms_checklist: {
    store_id: 'INTEGER',
    competence_period: 'TEXT',
    item_key: 'TEXT',
    status: 'TEXT',
    updated_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_by: 'INTEGER'
  }
};

async function ensureApTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS execution_control (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    obligation TEXT NOT NULL,
    competence_period TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    started_at TEXT,
    analyzing_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    UNIQUE(store_id, obligation, competence_period)
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS icms_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    competence_period TEXT NOT NULL,
    item_key TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    UNIQUE(store_id, competence_period, item_key)
  )`).run();

  for (const [table, columns] of Object.entries(AP_SCHEMA)) {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    const existing = new Set((result.results || []).map(row => row.name));
    for (const [column, type] of Object.entries(columns)) {
      if (existing.has(column)) continue;
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const apRoute = request.method === 'GET' && (
      url.pathname === '/api/apuracoes' ||
      url.pathname === '/api/icms-checklist' ||
      url.pathname === '/api/curva-abc-report'
    );

    if (apRoute) {
      try {
        await ensureApTables(env);
      } catch (error) {
        console.error('Apurações schema error:', error);
        return new Response(JSON.stringify({
          error: `Falha no banco das Apurações: ${error?.message || 'erro desconhecido'}`
        }), {
          status: 500,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            'cache-control': 'no-store'
          }
        });
      }
    }

    try {
      return await baseWorker.fetch(request, env, ctx);
    } catch (error) {
      console.error('Worker request error:', error);
      return new Response(JSON.stringify({
        error: error?.message || 'Erro interno do Worker.'
      }), {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      });
    }
  }
};
