import { defineConfig } from 'astro/config';
import { billApi } from './server/bill-api.mjs';

export default defineConfig({
  // Vite rejects requests for unknown hostnames; these let a shared tunnel link reach the dev or preview server.
  server: { allowedHosts: ['.trycloudflare.com', '.devtunnels.ms'] },
  // `astro dev` answers the bill inquiry through the same proxy as server/serve.mjs.
  integrations: [{ name: 'bill-api-proxy', hooks: { 'astro:server:setup': ({ server }) => void server.middlewares.use(billApi) } }],
});
