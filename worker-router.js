import baseWorker from './worker-main.js';
import apuracoesWorker from './status-flow-worker.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // A única implementação ativa da leitura de Apurações fica no
    // status-flow-worker. Isso evita que duas rotas diferentes disputem
    // /api/apuracoes e garante que a leitura use o mesmo fluxo do PUT.
    if (request.method === 'GET' && url.pathname === '/api/apuracoes') {
      return apuracoesWorker.fetch(request, env, ctx);
    }

    return baseWorker.fetch(request, env, ctx);
  }
};
