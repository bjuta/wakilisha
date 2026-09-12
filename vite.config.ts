import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const basePath = process.env.BASE_PATH || '/';
const apiPort = Number(process.env.WAKILISHA_V2_API_PORT || 4176);

export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __BASE_PATH__: JSON.stringify(basePath),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Compact and full player surfaces are permanent shell dependencies.
              // Keep their UI runtime cohesive without pulling route-local field
              // primitives into the public application entry.
              name: 'wk-player-runtime',
              test: /src[\\/]components[\\/]design-system[\\/]player[\\/](?:PlayerCompactSurface|PlayerFullSurface|SeekRail)\.tsx$/,
              priority: 100,
            },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/__wakilisha-v2-api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
        rewrite: (requestPath) => requestPath.replace(/^\/__wakilisha-v2-api/, ''),
      },
    },
  },
});
