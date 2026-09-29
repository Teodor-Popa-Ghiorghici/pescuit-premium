// Serves the layout mocks for FEEL_VISUAL_SOUND_PLAN.md §5.2 with the client's real
// fonts, tokens and card art. Run from the repo root:
//   npx vite --config docs/plan-evidence/mock/vite.config.ts
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../packages/client/public', import.meta.url)),
  plugins: [react()],
  server: { port: 5199, strictPort: true },
});
