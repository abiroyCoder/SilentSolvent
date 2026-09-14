import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import path from 'path';

export default defineConfig({
  plugins: [react(), wasm()],
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    }
  },
  resolve: {
    alias: {
      'isomorphic-ws': path.resolve(__dirname, './src/isomorphic-ws-fix.mjs'),
    }
  }
});
