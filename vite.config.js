import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'portfolio-component-reload',
      handleHotUpdate({ file, server }) {
        // Split text and pinned sections temporarily change React-owned DOM.
        // Reload component edits so the animation runtime starts with fresh nodes.
        if (file.endsWith('.jsx')) {
          server.ws.send({ type: 'full-reload' });
          return [];
        }
      },
    },
  ],
  server: {
    port: Number(process.env.PORT) || 4173,
  },
});
