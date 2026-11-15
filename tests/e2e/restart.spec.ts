import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { E2E_DB } from "../../playwright.config";

const PORT = 3101;

async function start(): Promise<ChildProcess> {
  const p = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", DATABASE_PATH: E2E_DB, FIRMS_BASE_URL: "http://127.0.0.1:9", FIRMS_MAP_KEY: "" },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/status`)).ok) return p;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("El servidor no arrancó");
}
const stop = (p: ChildProcess) => {
  try { process.kill(-p.pid!, "SIGTERM"); } catch {}
};

test("los datos persisten después de reiniciar el servidor", async () => {
  let p = await start();
  const a = await (await fetch(`http://127.0.0.1:${PORT}/api/status`)).json();
  stop(p);
  await new Promise((r) => setTimeout(r, 1000));
  p = await start();
  const b = await (await fetch(`http://127.0.0.1:${PORT}/api/status`)).json();
  stop(p);
  expect(a.totalDetections).toBeGreaterThan(0);
  expect(b.totalDetections).toBe(a.totalDetections);
  expect(b.lastSuccessAt).toBe(a.lastSuccessAt);
});
