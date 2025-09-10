import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      },
      server: {
        host: true, // Allow connections from other devices on the network
        proxy: {
          // Proxy API requests to the local backend server
          '/api': {
            target: 'http://localhost:3000', // Backend server address
            changeOrigin: true,
            // NO 'rewrite' rule. This forwards the path as-is.
            // Frontend asks for '/api/events', backend receives '/api/events'.
          },
        },
      },
    };
});
