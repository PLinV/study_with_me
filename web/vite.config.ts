import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// En dev (npm run dev), on s'appuie sur la stack docker pour l'API et les scènes.
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/scenes': 'http://127.0.0.1:8080',
    },
  },
});
