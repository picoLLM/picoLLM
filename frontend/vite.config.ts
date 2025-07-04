import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

// Load .env file from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true, // Listen on all addresses
    allowedHosts: [
      'localhost',
      'demo.picollm.co',
      '.picollm.co'
    ],
    proxy: {
      '/api': {
        // This should use the Docker service name, not 0.0.0.0
        target: process.env.VITE_BACKEND_URL || 'http://fastapi:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying:', req.method, req.url, 'to', options.target);
          });
        }
      }
    }
  },
  define: {
    __BACKEND_URL__: JSON.stringify('/api'),
    __DEFAULT_MODEL__: JSON.stringify(process.env.VITE_DEFAULT_MODEL || 'gemma3:4b'),
    __QDRANT_URI__: JSON.stringify(process.env.VITE_QDRANT_URI || 'http://qdrant:6333'),
    __OLLAMA_URI__: JSON.stringify(process.env.VITE_OLLAMA_URI || 'http://nginx/v1'),
  }
});