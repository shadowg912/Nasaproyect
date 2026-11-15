import { defineConfig } from "@playwright/test";
import path from "node:path";

export const E2E_DB = path.resolve("data/e2e/fuego-rd-e2e.sqlite");
export const PORT = 3100;

/**
 * Pruebas de extremo a extremo contra la compilación de producción
 * (ejecute `npm run build` antes). NASA se simula como INACCESIBLE apuntando
 * FIRMS_BASE_URL a un puerto cerrado local.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    command: `npx tsx tests/e2e/seed.ts && npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/status`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_PATH: E2E_DB,
      FIRMS_MAP_KEY: "",
      FIRMS_BASE_URL: "http://127.0.0.1:9",
      FIRMS_TIMEOUT_MS: "3000",
    },
  },
});
