import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import path from 'path';
import fs from 'fs';

const resolveModule = (pkg: string, nestedFallback?: string) => {
  const rootPath = path.resolve(__dirname, '../node_modules', pkg);
  if (fs.existsSync(rootPath)) return rootPath;
  if (nestedFallback) {
    const fallbackPath = path.resolve(__dirname, '../node_modules', nestedFallback);
    if (fs.existsSync(fallbackPath)) return fallbackPath;
  }
  return rootPath;
};

export default defineConfig({
  plugins: [react(), wasm()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
      define: {
        global: 'globalThis',
      },
    }
  },
  resolve: {
    alias: {
      '@midnight-ntwrk/ledger-v8': resolveModule('@midnight-ntwrk/ledger-v8', '@midnight-ntwrk/midnight-js-protocol/node_modules/@midnight-ntwrk/ledger-v8'),
      '@midnight-ntwrk/onchain-runtime-v3': resolveModule('@midnight-ntwrk/onchain-runtime-v3', '@midnight-ntwrk/compact-runtime/node_modules/@midnight-ntwrk/onchain-runtime-v3'),
      'isomorphic-ws': path.resolve(__dirname, './src/isomorphic-ws-fix.mjs'),
      buffer: 'buffer',
    }
  }
});
