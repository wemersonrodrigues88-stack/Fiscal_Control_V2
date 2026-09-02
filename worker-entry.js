import app from './worker.js';
import { handlePasswordReset } from './src/password-reset.js';
import { handleAuthRuntime } from './src/auth-runtime.js';
import { handleDeadlineRuntime } from './src/deadline-runtime.js';
import { prepareStoreRuntime, sortStorePayload } from './src/store-runtime.js';

async function enhanceHtmlResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  const tags = '<script src="/carteiras-enhancement.js" defer></script><script src="/prazos-enhancement.js" defer></script>';
  const enhanced = html.includes('/prazos-enhancement.js') ? html : html.replace('</body>', `${tags}</body>`);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');
  return new Response(enhanced, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const resetResponse = await handlePasswordReset(request, env);
    if (resetResponse) return resetResponse;

    const authResponse = await handleAuthRuntime(request, env);
    if (authResponse) return authResponse;

    const deadlineResponse = await handleDeadlineRuntime(request, env);
    if (deadlineResponse) return deadlineResponse;

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

    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) return enhanceHtmlResponse(response);
    return response;
  }
};
