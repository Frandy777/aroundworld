import { realpathSync } from 'node:fs';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Which checkout this dev server is and which process runs it: shot-matrix probes /__aw-id so a server of another
// worktree (or a stale one from before this endpoint) is never shot as this checkout. Dev only — nothing is served in production.
const devId = (): Plugin => ({
  name: 'aw-dev-id',
  apply: 'serve',
  configureServer(server) {
    const id = JSON.stringify({ root: realpathSync(server.config.root), pid: process.pid, started: Date.now() });
    server.middlewares.use('/__aw-id', (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(id);
    });
  },
});

export default defineConfig({
  plugins: [devId(), react(), cloudflare()],
});
