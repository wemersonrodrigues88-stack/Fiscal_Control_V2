import app from './worker.js';
import { handlePasswordReset } from './src/password-reset.js';

export default {
  async fetch(request, env, ctx) {
    const resetResponse = await handlePasswordReset(request, env);
    if (resetResponse) return resetResponse;
    return app.fetch(request, env, ctx);
  }
};
