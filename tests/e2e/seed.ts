import fs from "node:fs";
import path from "node:path";
import { openDatabase, runMigrations } from "../../src/db/client";
import { getConfig } from "../../src/lib/config";
import { runSync } from "../../src/server/firms/ingest";
import { seedTerritory } from "../../src/server/seed";
import { toDate, addDays } from "../../src/lib/dates";

/** Crea una base de prueba con detecciones de ejemplo dentro de RD (fechas recientes). */
const E2E_DB = process.env.DATABASE_PATH!;

async function seed() {
  fs.rmSync(path.dirname(E2E_DB), { recursive: true, force: true });
  const today = toDate(new Date());
  const y = addDays(today, -1);
  const csv =
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n" +
    `18.48610,-69.93120,330.5,0.39,0.36,${y},0612,N20,VIIRS,n,2.0NRT,290.1,4.2,N\n` +
    `19.45170,-70.69700,345.2,0.41,0.37,${y},1754,N20,VIIRS,h,2.0NRT,300.3,12.8,D\n` +
    `18.73000,-70.16000,300.0,0.40,0.38,${today},0600,N20,VIIRS,l,2.0NRT,280.0,1.5,N\n` +
    `18.25000,-70.33000,310.0,0.40,0.38,${today},0600,N20,VIIRS,h,2.0NRT,280.0,22.5,N\n` +
    `18.85700,-71.77800,333.0,0.40,0.38,${today},1754,N20,VIIRS,h,2.0NRT,295.0,3.1,D\n`; // Haití: excluido
  const cfg = { ...getConfig(), databasePath: E2E_DB, mapKey: "", sources: ["VIIRS_NOAA20_NRT"] as never };
  const db = openDatabase(E2E_DB);
  runMigrations(db);
  seedTerritory(db, cfg.geoDir);
  const r = await runSync(db, cfg, { kind: "public_feed", fetchImpl: async () => new Response(csv), trigger: "e2e-setup" });
  if (r.rowsInserted !== 4) throw new Error(`Semilla e2e inesperada: ${JSON.stringify(r)}`);
  // Para que el estado no sea "fresh" ni bloquee el enfriamiento de /api/sync
  db.$client.prepare("UPDATE ingestion_runs SET started_at = '2020-01-01T00:00:00Z', finished_at = '2020-01-01T00:00:10Z'").run();
  db.$client.close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
