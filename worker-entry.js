import app from './worker.js';
import { handlePasswordReset } from './src/password-reset.js';
import { handleAuthRuntime } from './src/auth-runtime.js';
import { prepareStoreRuntime, sortStorePayload } from './src/store-runtime.js';

export default {
  async fetch(request, env, ctx) {
    const resetResponse = await handlePasswordReset(request, env);
    if (resetResponse) return resetResponse;

    const authResponse = await handleAuthRuntime(request, env);
    if (authResponse) return authResponse;

    const url = new URL(request.url);
    const isStoreWrite = request.method === 'PUT' && /^\/api\/stores\/\d+$/.test(url.pathname);
    const isStoreRead = request.method === 'GET' && (url.pathname === '/api/state' || url.pathname === '/api/stores');

    if (isStoreWrite || isStoreRead) await prepareStoreRuntime(env);

    const response = await app.fetch(request, env, ctx);

    if (isStoreRead && response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json();
      return new Response(JSON.stringify(sortStorePayload(payload)), {
        status: response.status,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    return response;
  }
};
