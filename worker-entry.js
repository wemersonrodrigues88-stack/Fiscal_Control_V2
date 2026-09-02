import app from './worker.js';
import { handlePasswordReset } from './src/password-reset.js';
import { handleAuthRuntime } from './src/auth-runtime.js';

export default {
  async fetch(request, env, ctx) {
    const resetResponse = await handlePasswordReset(request, env);
    if (resetResponse) return resetResponse;

    const authResponse = await handleAuthRuntime(request, env);
    if (authResponse) return authResponse;

    return app.fetch(request, env, ctx);
  }
};
