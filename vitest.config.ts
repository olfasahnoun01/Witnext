import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone Vitest config — intentionally NOT extending vite.config.ts, whose
// loadEnv() throws when Supabase env vars are absent. Tests target pure logic
// (pricing, VAT, accounting math) and must run without any runtime env.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
  },
});
