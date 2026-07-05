import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '#shared': resolve(__dirname, 'shared'),
      '~': resolve(__dirname, '.'),
    },
  },
});
