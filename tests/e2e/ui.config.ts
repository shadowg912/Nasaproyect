import { defineConfig } from '@playwright/test';
import { E2E_DB, PORT } from '../../playwright.config';
import { fileURLToPath } from 'node:url';

// Permite verificar la interfaz mientras la otra parte incorpora módulos del servidor.
// La configuración principal sigue comprobando la compilación de producción.
export default defineConfig({
  testDir: '.',
  testMatch: ['exploration.spec.ts', 'offline.spec.ts'],
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: `npx tsx tests/e2e/seed.ts && npm run dev -- --port ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/status`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_PATH: E2E_DB,
      FIRMS_MAP_KEY: '',
      FIRMS_BASE_URL: 'http://127.0.0.1:9',
      FIRMS_TIMEOUT_MS: '3000',
    },
  },
});
