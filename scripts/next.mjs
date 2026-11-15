// Ejecuta la CLI de Next.js con la telemetría desactivada, de forma portable
// (Windows, macOS, Linux) sin depender de la sintaxis `VAR=1 cmd` de shells POSIX.
// Uso: node scripts/next.mjs <dev|build|start> [...args]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
