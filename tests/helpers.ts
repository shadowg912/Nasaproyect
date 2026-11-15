import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, runMigrations, type DB } from "@/db/client";
import { getConfig, type AppConfig } from "@/lib/config";
import { seedTerritory } from "@/server/seed";

export const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
export const HEADER = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n";

export function tempDb(): { db: DB; file: string; cfg: AppConfig; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fuego-rd-"));
  const file = path.join(dir, "test.sqlite");
  const cfg = { ...getConfig(), databasePath: file, mapKey: "TESTKEY123", sources: ["VIIRS_NOAA20_NRT"] as AppConfig["sources"] };
  const db = openDatabase(file);
  runMigrations(db);
  seedTerritory(db, cfg.geoDir);
  // cleanup cierra ctx.db (no la conexión original): las pruebas pueden reemplazarla al reabrir la base,
  // y en Windows un archivo SQLite abierto no se puede borrar (EBUSY).
  const ctx = {
    db,
    file,
    cfg,
    cleanup: () => {
      if (ctx.db.$client.open) ctx.db.$client.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
  return ctx;
}

/** fetch simulado: devuelve el cuerpo indicado o lanza un error de red. */
export function mockFetch(handler: (url: string) => { status?: number; body: string } | Error) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const r = handler(url);
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status ?? 200 });
  };
  return Object.assign(impl, { calls });
}
