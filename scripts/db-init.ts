/**
 * Crea el directorio de datos, la base SQLite (modo WAL), aplica migraciones y
 * siembra provincias y municipios desde public/geo/.
 * Uso: npm run db:init   |   npm run db:migrate (solo migraciones)
 */
import "./_env";
import { openDatabase, runMigrations } from "@/db/client";
import { getConfig } from "@/lib/config";
import { seedTerritory } from "@/server/seed";

const cfg = getConfig();
const db = openDatabase(cfg.databasePath);
runMigrations(db);
console.log(`Base de datos: ${cfg.databasePath}`);
console.log(`Modo de diario: ${db.$client.pragma("journal_mode", { simple: true })}`);
if (!process.argv.includes("--migrate-only")) {
  const n = seedTerritory(db, cfg.geoDir);
  console.log(`Territorio: ${n.provinces} provincias, ${n.municipalities} municipios.`);
}
const { n } = db.$client.prepare("SELECT COUNT(*) AS n FROM fire_detections").get() as { n: number };
console.log(`Detecciones almacenadas: ${n}`);
if (!cfg.mapKey) {
  console.log("\nFIRMS_MAP_KEY vacía: `npm run sync:firms` usará el feed público de 7 días de NASA FIRMS.");
}
db.$client.close();
