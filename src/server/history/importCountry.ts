import fs from "node:fs";
import path from "node:path";
import type { DB } from "@/db/client";
import type { AppConfig } from "@/lib/config";
import { type FetchLike, redact } from "@/server/firms/client";
import { parseFirmsCsv } from "@/server/firms/csv";
import { monthlyCounts } from "@/server/harmonize/cells";
import { getCountry, setCountryMode } from "./countries";
import { addMonthlyCounts, recordCoverage, saveDetections } from "./store";

export const PRODUCTS = [
  { product: "modis", source: "MODIS_SP", family: "modis" as const, start: 2000 },
  { product: "viirs-snpp", source: "VIIRS_SNPP_SP", family: "viirs" as const, start: 2012 },
];
/** Por encima de este tamaño total de CSV se usa el modo agregado (spec §4). */
export const AGGREGATE_THRESHOLD_BYTES = 500 * 1024 * 1024;
const AGGREGATE_RAW_DAYS = 365;

export interface ImportOptions {
  localDir?: string;
  fetchImpl?: FetchLike;
  onProgress?: (done: number, total: number) => void;
  years?: { modis: [number, number]; viirs: [number, number] };
  now?: Date;
}

interface FileTask {
  product: string;
  source: string;
  year: number;
}

export const archiveUrl = (cfg: AppConfig, product: string, year: number, firmsName: string) =>
  `${cfg.firmsBaseUrl}/data/country/${product}/${year}/${product}_${year}_${firmsName}.csv`;

function plan(db: DB, iso3: string, opts: ImportOptions, nowYear: number): FileTask[] {
  const state = db.$client.prepare("SELECT state FROM country_loads WHERE iso3 = ? AND product = ? AND year = ?");
  const tasks: FileTask[] = [];
  for (const p of PRODUCTS) {
    const [from, to] = opts.years?.[p.family] ?? [p.start, nowYear];
    for (let year = from; year <= to; year++) {
      const s = (state.get(iso3, p.product, year) as { state: string } | undefined)?.state;
      if (s === "done" || (s === "missing" && year < nowYear - 1)) continue;
      tasks.push({ product: p.product, source: p.source, year });
    }
  }
  return tasks;
}

async function estimateBytes(cfg: AppConfig, tasks: FileTask[], firmsName: string, opts: ImportOptions): Promise<number> {
  if (opts.localDir) return 0;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let total = 0;
  for (const t of tasks) {
    const res = await fetchImpl(archiveUrl(cfg, t.product, t.year, firmsName), { method: "HEAD" }).catch(() => null);
    total += Number(res?.headers.get("content-length") ?? 0);
  }
  return total;
}

/** Texto del archivo (local o descargado) o null si FIRMS no lo tiene (404). */
async function readFile(cfg: AppConfig, t: FileTask, firmsName: string, opts: ImportOptions): Promise<string | null> {
  if (opts.localDir) {
    const local = path.join(opts.localDir, t.product, `${t.year}.csv`);
    return fs.existsSync(local) ? fs.readFileSync(local, "utf8") : null;
  }
  const res = await (opts.fetchImpl ?? fetch)(archiveUrl(cfg, t.product, t.year, firmsName));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`FIRMS respondió ${res.status} para ${t.product} ${t.year}`);
  return res.text();
}

/**
 * Importa el historial de un país desde los archivos anuales de FIRMS (MODIS desde 2000, VIIRS Suomi NPP desde 2012).
 * Reanudable por (producto, año) mediante `country_loads`. Nunca borra datos.
 */
export async function importCountry(db: DB, cfg: AppConfig, iso3: string, opts: ImportOptions = {}) {
  const country = getCountry(db, iso3);
  if (!country) throw new Error(`País desconocido: ${iso3}`);
  const now = opts.now ?? new Date();
  const tasks = plan(db, iso3, opts, now.getUTCFullYear());
  const mode = country.mode ?? ((await estimateBytes(cfg, tasks, country.firmsName, opts)) > AGGREGATE_THRESHOLD_BYTES ? "aggregate" : "full");
  setCountryMode(db, iso3, mode);
  const sqlite = db.$client;
  const runId = Number(
    sqlite
      .prepare("INSERT INTO ingestion_runs (kind, trigger, status, sources, started_at) VALUES ('history', 'country-archive', 'running', ?, ?)")
      .run(`${iso3}:${PRODUCTS.map((p) => p.source).join(",")}`, now.toISOString()).lastInsertRowid,
  );
  const setLoad = sqlite.prepare(`
    INSERT INTO country_loads (iso3, product, year, state, rows, error, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(iso3, product, year) DO UPDATE SET state = excluded.state, rows = excluded.rows, error = excluded.error, updated_at = excluded.updated_at`);
  const rawSince = new Date(now.getTime() - AGGREGATE_RAW_DAYS * 86400000).toISOString().slice(0, 10);
  let rows = 0;
  let failed = 0;
  for (const [i, t] of tasks.entries()) {
    try {
      const text = await readFile(cfg, t, country.firmsName, opts);
      if (text === null) {
        setLoad.run(iso3, t.product, t.year, "missing", 0, null, new Date().toISOString());
      } else {
        const { records } = parseFirmsCsv(text, t.source);
        const keep = mode === "full" ? records : records.filter((r) => r.acqDate >= rawSince);
        if (mode === "aggregate") addMonthlyCounts(db, iso3, monthlyCounts(records.map((r) => ({
          lat: r.latitude, lon: r.longitude, acqDate: r.acqDate, family: r.sensorFamily, satellite: r.satellite, confidence: r.confidence, fireType: r.fireType,
        }))));
        rows += saveDetections(db, keep, { iso3, geoDir: cfg.geoDir, runId, onlyInCountry: false });
        recordCoverage(db, t.source, `${t.year}-01-01`, `${t.year}-12-31`, records.length, runId);
        setLoad.run(iso3, t.product, t.year, "done", records.length, null, new Date().toISOString());
      }
    } catch (e) {
      failed++;
      const msg = redact(e instanceof Error ? e.message : String(e), cfg.mapKey);
      setLoad.run(iso3, t.product, t.year, "error", 0, msg, new Date().toISOString());
    }
    opts.onProgress?.(i + 1, tasks.length);
  }
  sqlite
    .prepare("UPDATE ingestion_runs SET status = ?, finished_at = ?, rows_inserted = ? WHERE id = ?")
    .run(failed === 0 ? "success" : failed === tasks.length ? "failed" : "partial", new Date().toISOString(), rows, runId);
  return { rows, mode };
}

/** Importa un CSV de la API de área (bbox) quedándose solo con los puntos dentro del país. Devuelve las filas guardadas. */
export function importAreaFile(db: DB, file: string, source: string, iso3: "DOM", geoDir = "./public/geo"): number {
  const { records } = parseFirmsCsv(fs.readFileSync(file, "utf8"), source);
  const saved = saveDetections(db, records, { iso3, geoDir: path.resolve(geoDir), runId: null, onlyInCountry: true });
  if (source.endsWith("_SP") && records.length) {
    const dates = records.map((r) => r.acqDate).sort();
    recordCoverage(db, source, dates[0], dates.at(-1)!, records.length, null);
  }
  return saved;
}
