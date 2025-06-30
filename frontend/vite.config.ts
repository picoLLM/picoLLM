import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

// Load .env file from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://0.0.0.0:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  define: {
    __BACKEND_URL__: JSON.stringify(process.env.VITE_BACKEND_URL || 'http://0.0.0.0:8081'),
    __DEFAULT_MODEL__: JSON.stringify(process.env.VITE_DEFAULT_MODEL || 'gemma3:4b'),
    __QDRANT_URI__: JSON.stringify(process.env.VITE_QDRANT_URI || 'http://0.0.0.0:6333'),
    __OLLAMA_URI__: JSON.stringify(process.env.VITE_OLLAMA_URI || 'http://nginx/v1'),
  }
});