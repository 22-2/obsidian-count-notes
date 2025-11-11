import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    deps: {
      inline: ['dexie'],
    },
  },
  resolve: {
    alias: {
      'src': path.resolve(__dirname, './src'),
      'e2e': path.resolve(__dirname, './e2e'),
    },
  },
});
