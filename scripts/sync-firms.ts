/**
 * Sincronización manual con NASA FIRMS.
 *
 * Uso:
 *   npm run sync:firms                  # automático: API de área si hay MAP_KEY, si no feed público
 *   npm run sync:firms -- --public      # forzar feed público (7 días, sin clave)
 *   npm run sync:firms -- --days 5      # días a consultar (1..5)
 *   npm run sync:firms -- --sources VIIRS_NOAA20_NRT,VIIRS_SNPP_NRT
 */
import "./_env";
import { parseArgs } from "node:util";
import { openDatabase, runMigrations } from "@/db/client";
import { getConfig } from "@/lib/config";
import { runSync } from "@/server/firms/ingest";
import { seedTerritory } from "@/server/seed";

const { values } = parseArgs({
  options: {
    public: { type: "boolean", default: false },
    days: { type: "string" },
    sources: { type: "string" },
    trigger: { type: "string", default: "manual" },
  },
});

export async function syncOnce(trigger = values.trigger!) {
  const cfg = getConfig();
  const db = openDatabase(cfg.databasePath);
  runMigrations(db);
  const { n } = db.$client.prepare("SELECT COUNT(*) AS n FROM provinces").get() as { n: number };
  if (!n) seedTerritory(db, cfg.geoDir);
  try {
    const r = await runSync(db, cfg, {
      kind: values.public ? "public_feed" : "auto",
      trigger,
      dayRange: values.days ? Number(values.days) : undefined,
      sources: values.sources?.split(","),
      log: (m) => console.log(m),
    });
    console.log(
      `\nResultado: ${r.status} (${r.kind}) — ${r.requests} solicitudes, ${r.rowsFetched} filas, ` +
        `${r.rowsInCountry} en RD, ${r.rowsInserted} nuevas, ${r.rowsUpdated} actualizadas, ${r.rowsRejected} rechazadas.`,
    );
    if (r.status === "success" && r.rowsInserted === 0) console.log("Sin detecciones nuevas (la conexión con NASA funcionó).");
    for (const e of r.errors) console.error(`Error [${e.type}] ${e.source}: ${e.message}`);
    return r;
  } finally {
    db.$client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncOnce().then((r) => process.exit(r.status === "failed" ? 1 : 0));
}
