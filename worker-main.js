import baseWorker from './status-flow-worker.js';

export default {
  async fetch(request, env, ctx) {
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
