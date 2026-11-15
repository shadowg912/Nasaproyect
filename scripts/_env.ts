import fs from "node:fs";

/** Carga .env (si existe) sin sobrescribir variables ya definidas. */
for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) process.loadEnvFile(f);
}
