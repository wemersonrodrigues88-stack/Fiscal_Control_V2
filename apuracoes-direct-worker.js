import statusWorker from './status-flow-worker-fixed.js';

// Roteador compatível das Apurações.
// A implementação completa e consistente das rotas de Apurações já está em
// status-flow-worker-fixed.js. Este arquivo apenas encaminha as requisições
// para ela, evitando uma segunda implementação de GET /api/apuracoes.
export default {
  async fetch(request, env, ctx) {
    return statusWorker.fetch(request, env, ctx);
  }
};
