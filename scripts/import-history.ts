/**
 * Importa un rango histórico desde la API de área de NASA FIRMS, en lotes de 5 días.
 * Requiere FIRMS_MAP_KEY. Registra en ingestion_coverage solo los intervalos
 * descargados con éxito y, por defecto, omite los ya cubiertos.
 *
 * Los productos NRT solo cubren los meses recientes; para años anteriores use los
 * productos de procesamiento estándar (*_SP). El script consulta data_availability
 * y recorta el rango a lo que NASA realmente ofrece.
 *
 * Uso:
 *   npm run import:history -- --from 2024-01-01 --to 2024-12-31
 *   npm run import:history -- --from 2025-03-01 --to 2025-03-31 --sources VIIRS_NOAA20_SP,VIIRS_SNPP_SP
 *   Opciones: --force (re-descargar cubiertos), --delay 1500 (ms entre solicitudes), --dry-run
 */
import "./_env";
import { parseArgs } from "node:util";
import { openDatabase, runMigrations } from "@/db/client";
import { getConfig, SP_SOURCES } from "@/lib/config";
import { chunkRange, isIsoDate } from "@/lib/dates";
import { fetchDataAvailability } from "@/server/firms/client";
import { coveredDays, runSync, uncoveredRuns } from "@/server/firms/ingest";
import { seedTerritory } from "@/server/seed";

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    to: { type: "string" },
    sources: { type: "string" },
    force: { type: "boolean", default: false },
    delay: { type: "string", default: "1500" },
    "dry-run": { type: "boolean", default: false },
  },
});

const cfg = getConfig();
if (!cfg.mapKey) {
  console.error("Se requiere FIRMS_MAP_KEY para importar historial. Consulte README.md → «Obtener una MAP_KEY».");
  process.exit(2);
}
if (!isIsoDate(values.from) || !isIsoDate(values.to) || values.from > values.to) {
  console.error("Indique --from y --to con formato AAAA-MM-DD (from <= to).");
  process.exit(2);
}
const sources = values.sources ? values.sources.split(",").map((s) => s.trim()) : [...SP_SOURCES];
const db = openDatabase(cfg.databasePath);
runMigrations(db);
if (!(db.$client.prepare("SELECT COUNT(*) AS n FROM provinces").get() as { n: number }).n) seedTerritory(db, cfg.geoDir);

let availability: Awaited<ReturnType<typeof fetchDataAvailability>> = [];
try {
  availability = await fetchDataAvailability(cfg, "ALL");
} catch (e) {
  console.error(`No se pudo consultar data_availability: ${(e as Error).message}`);
  process.exit(1);
}

let total = 0;
for (const source of sources) {
  const a = availability.find((x) => x.dataId === source);
  if (!a) {
    console.warn(`${source}: no figura en data_availability; se omite.`);
    continue;
  }
  const from = values.from! < a.minDate ? a.minDate : values.from!;
  const to = values.to! > a.maxDate ? a.maxDate : values.to!;
  if (from > to) {
    console.warn(`${source}: disponible ${a.minDate}..${a.maxDate}, fuera del rango solicitado; se omite.`);
    continue;
  }
  const covered = values.force ? new Set<string>() : coveredDays(db, source, from, to);
  const pending = uncoveredRuns(from, to, covered).flatMap(([a, b]) => chunkRange(a, b, 5));
  console.log(`${source}: ${from}..${to} → ${pending.length} lotes pendientes (${covered.size} días ya cubiertos).`);
  if (values["dry-run"] || !pending.length) continue;
  const r = await runSync(db, cfg, {
    kind: "history",
    trigger: "import",
    sources: [source],
    from,
    to,
    skipCovered: !values.force,
    delayMs: Number(values.delay),
    log: (m) => console.log(m),
  });
  total += r.rowsInserted;
  console.log(`${source}: ${r.status}, ${r.rowsInserted} nuevas, ${r.errors.length} errores.`);
  if (r.status === "locked") break;
  if (r.errors.some((e) => e.type === "auth" || e.type === "rate_limit")) {
    console.error("Se detiene la importación (clave inválida o límite de transacciones). Reintente más tarde: lo ya descargado se conserva.");
    break;
  }
}
console.log(`\nImportación terminada: ${total} detecciones nuevas.`);
db.$client.close();
