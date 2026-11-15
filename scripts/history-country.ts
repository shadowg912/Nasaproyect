/**
 * Importa el historial MODIS + VIIRS de un país desde los archivos anuales de NASA FIRMS y reconstruye su serie
 * armonizada.
 * Uso: npm run history:country -- DOM [--local data/raw/firms-country] [--area data/raw/firms-area/2026] [--rebuild-only]
 */
import "./_env";
import fs from "node:fs";
import path from "node:path";
import { openDatabase, runMigrations } from "@/db/client";
import { getConfig } from "@/lib/config";
import { seedCountries } from "@/server/history/countries";
import { importAreaFile, importCountry } from "@/server/history/importCountry";
import { rebuildHarmonized } from "@/server/history/rebuild";
import { seedTerritory } from "@/server/seed";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const iso3 = (args.find((a) => /^[A-Z]{3}$/.test(a)) ?? "").toUpperCase();
if (!iso3) {
  console.error("Indique el país en ISO3, p. ej.: npm run history:country -- DOM");
  process.exit(1);
}

const cfg = getConfig();
const db = openDatabase(cfg.databasePath);
runMigrations(db);
seedTerritory(db, cfg.geoDir);
seedCountries(db, cfg.geoDir);

if (!args.includes("--rebuild-only")) {
  const started = Date.now();
  const r = await importCountry(db, cfg, iso3, {
    localDir: flag("--local"),
    onProgress: (done, total) => process.stdout.write(`\r  archivos ${done}/${total}`),
  });
  console.log(`\n${iso3}: ${r.rows} focos guardados (modo ${r.mode}) en ${((Date.now() - started) / 1000).toFixed(1)} s`);
  const areaDir = flag("--area");
  if (areaDir && iso3 === "DOM") {
    for (const f of fs.readdirSync(areaDir).filter((x) => x.endsWith(".csv"))) {
      const n = importAreaFile(db, path.join(areaDir, f), path.basename(f, ".csv"), "DOM", cfg.geoDir);
      console.log(`  ${f}: ${n} focos dentro de RD`);
    }
  }
}

const cal = rebuildHarmonized(db, iso3);
if (cal) {
  console.log(
    `Calibración ${iso3}: k = ${cal.k.toFixed(3)} (IC 95 %: ${cal.ci[0].toFixed(3)}–${cal.ci[1].toFixed(3)}), ` +
      `R² = ${cal.r2.toFixed(3)}, k Terra = ${cal.kTerra.toFixed(3)}, k NOAA-20 = ${cal.kNoaa20?.toFixed(3) ?? "—"}, ` +
      `solape ${cal.overlapYears.join("–")}`,
  );
} else {
  console.log(`${iso3}: sin meses suficientes de solape MODIS/VIIRS para calibrar.`);
}
db.$client.close();
