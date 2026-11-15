import type { DB } from "@/db/client";
import type { AppConfig } from "@/lib/config";
import { addDays, chunkRange, daysBetween, toDate } from "@/lib/dates";
import { classifyPoint, loadTerritory } from "@/server/geo";
import { acquireLock, releaseLock } from "@/server/lock";
import { parseFirmsCsv, type NormalizedDetection } from "./csv";
import {
  areaUrl,
  fetchText,
  FirmsError,
  hasPublicFeed,
  PUBLIC_FEED_DAYS,
  publicFeedUrl,
  redact,
  toFirmsError,
  type ErrorType,
  type FetchLike,
} from "./client";

export const SYNC_LOCK = "firms-sync";
const MAX_AREA_DAYS = 5;

export type SyncKind = "sync" | "history" | "public_feed";

export interface SyncOptions {
  kind?: SyncKind | "auto";
  trigger?: string;
  sources?: string[];
  dayRange?: number;
  /** Solo para historial: rango cerrado en UTC. */
  from?: string;
  to?: string;
  /** Historial: omitir intervalos ya cubiertos por la misma fuente. */
  skipCovered?: boolean;
  delayMs?: number;
  fetchImpl?: FetchLike;
  log?: (msg: string) => void;
  now?: Date;
}

interface PlannedRequest {
  source: string;
  url: string;
  dateFrom: string;
  dateTo: string;
}

export interface SyncResult {
  status: "success" | "partial" | "failed" | "locked" | "nothing_to_do";
  runId?: number;
  kind?: SyncKind;
  requests: number;
  rowsFetched: number;
  rowsInCountry: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsRejected: number;
  errors: { source: string; dateFrom: string; dateTo: string; type: ErrorType; message: string }[];
}

export function resolveKind(cfg: AppConfig, kind: SyncOptions["kind"]): SyncKind {
  if (kind && kind !== "auto") return kind;
  return cfg.mapKey ? "sync" : "public_feed";
}

/** Intervalos ya cubiertos para una fuente (como conjunto de días). */
export function coveredDays(db: DB, source: string, from: string, to: string): Set<string> {
  const rows = db.$client
    .prepare("SELECT date_from AS f, date_to AS t FROM ingestion_coverage WHERE source = ? AND date_to >= ? AND date_from <= ?")
    .all(source, from, to) as { f: string; t: string }[];
  const days = new Set<string>();
  for (const r of rows) for (let d = r.f < from ? from : r.f; d <= r.t && d <= to; d = addDays(d, 1)) days.add(d);
  return days;
}

/** Tramos contiguos de días no cubiertos dentro de [from, to]. */
export function uncoveredRuns(from: string, to: string, covered: Set<string>): Array<[string, string]> {
  const runs: Array<[string, string]> = [];
  let start: string | null = null;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!covered.has(d)) start ??= d;
    else if (start) (runs.push([start, addDays(d, -1)]), (start = null));
  }
  if (start) runs.push([start, to]);
  return runs;
}

function plan(db: DB, cfg: AppConfig, kind: SyncKind, opts: SyncOptions, today: string): PlannedRequest[] {
  const sources = opts.sources?.length ? opts.sources : cfg.sources;
  if (kind === "public_feed") {
    return sources.filter(hasPublicFeed).map((source) => ({
      source,
      url: publicFeedUrl(cfg, source),
      dateFrom: addDays(today, -(PUBLIC_FEED_DAYS - 1)),
      dateTo: today,
    }));
  }
  if (!cfg.mapKey) throw new FirmsError("config", "FIRMS_MAP_KEY no configurada");
  if (kind === "sync") {
    const range = Math.min(MAX_AREA_DAYS, Math.max(1, opts.dayRange ?? cfg.dayRange));
    return sources.map((source) => ({ source, url: areaUrl(cfg, source, range), dateFrom: addDays(today, -(range - 1)), dateTo: today }));
  }
  // history
  if (!opts.from || !opts.to || opts.from > opts.to) throw new FirmsError("config", "Rango de fechas inválido");
  const out: PlannedRequest[] = [];
  for (const source of sources) {
    const covered = opts.skipCovered === false ? new Set<string>() : coveredDays(db, source, opts.from, opts.to);
    for (const [gapFrom, gapTo] of uncoveredRuns(opts.from, opts.to, covered)) {
      for (const [a, b] of chunkRange(gapFrom, gapTo, MAX_AREA_DAYS)) {
        out.push({ source, url: areaUrl(cfg, source, daysBetween(a, b) + 1, a), dateFrom: a, dateTo: b });
      }
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta una sincronización completa: consultar → descargar → validar →
 * normalizar → filtrar territorialmente → deduplicar → guardar → registrar.
 * Nunca elimina datos existentes; un fallo de NASA solo se registra.
 */
export async function runSync(db: DB, cfg: AppConfig, opts: SyncOptions = {}): Promise<SyncResult> {
  const log = opts.log ?? (() => {});
  const result: SyncResult = {
    status: "success",
    requests: 0,
    rowsFetched: 0,
    rowsInCountry: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsRejected: 0,
    errors: [],
  };
  const kind = resolveKind(cfg, opts.kind);
  result.kind = kind;
  const owner = acquireLock(db, SYNC_LOCK, kind === "history" ? 6 * 3600_000 : 30 * 60_000);
  if (!owner) {
    log("Ya hay una sincronización en curso; se omite esta ejecución.");
    return { ...result, status: "locked" };
  }
  const sqlite = db.$client;
  const startedAt = new Date().toISOString();
  let runId: number | undefined;
  try {
    // Ejecuciones que quedaron "running" por un proceso interrumpido.
    sqlite
      .prepare("UPDATE ingestion_runs SET status = 'failed', error_type = 'other', error_message = 'Proceso interrumpido', finished_at = ? WHERE status = 'running'")
      .run(startedAt);

    const today = toDate(opts.now ?? new Date());
    let requests: PlannedRequest[] = [];
    let planError: FirmsError | undefined;
    try {
      requests = plan(db, cfg, kind, opts, today);
    } catch (e) {
      planError = toFirmsError(e);
    }
    const sources = opts.sources?.length ? opts.sources : cfg.sources;
    runId = Number(
      sqlite
        .prepare(
          "INSERT INTO ingestion_runs (kind, trigger, status, sources, date_from, date_to, started_at) VALUES (?, ?, 'running', ?, ?, ?, ?)",
        )
        .run(
          kind,
          opts.trigger ?? "manual",
          sources.join(","),
          requests.reduce<string | null>((m, r) => (m === null || r.dateFrom < m ? r.dateFrom : m), null) ?? opts.from ?? null,
          requests.reduce<string | null>((m, r) => (m === null || r.dateTo > m ? r.dateTo : m), null) ?? opts.to ?? null,
          startedAt,
        ).lastInsertRowid,
    );
    result.runId = runId;

    if (planError) {
      result.errors.push({ source: "*", dateFrom: "", dateTo: "", type: planError.type, message: planError.message });
    } else if (requests.length === 0) {
      result.status = "nothing_to_do";
      log("No hay intervalos pendientes por descargar.");
    }

    const territory = loadTerritory(cfg.geoDir);
    const exists = sqlite.prepare("SELECT 1 FROM fire_detections WHERE id = ?");
    const upsert = sqlite.prepare(`
      INSERT INTO fire_detections (id, source, satellite, instrument, latitude, longitude, acq_date, acq_time, acquired_at,
        brightness, bright_t31, scan, track, frp, confidence, confidence_raw, version, daynight,
        province_id, municipality_id, ingestion_run_id, first_seen_at, updated_at)
      VALUES (@id, @source, @satellite, @instrument, @latitude, @longitude, @acqDate, @acqTime, @acquiredAt,
        @brightness, @brightnessT31, @scan, @track, @frp, @confidence, @confidenceRaw, @version, @daynight,
        @provinceId, @municipalityId, @runId, @now, @now)
      ON CONFLICT(id) DO UPDATE SET
        brightness = excluded.brightness, bright_t31 = excluded.bright_t31, frp = excluded.frp,
        confidence = excluded.confidence, confidence_raw = excluded.confidence_raw, version = excluded.version,
        daynight = excluded.daynight, province_id = excluded.province_id, municipality_id = excluded.municipality_id,
        ingestion_run_id = excluded.ingestion_run_id, updated_at = excluded.updated_at
      WHERE fire_detections.brightness IS NOT excluded.brightness OR fire_detections.frp IS NOT excluded.frp
        OR fire_detections.confidence IS NOT excluded.confidence OR fire_detections.version IS NOT excluded.version
        OR fire_detections.province_id IS NOT excluded.province_id OR fire_detections.municipality_id IS NOT excluded.municipality_id`);
    const coverage = sqlite.prepare(`
      INSERT INTO ingestion_coverage (source, date_from, date_to, row_count, run_id, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, date_from, date_to) DO UPDATE SET row_count = excluded.row_count, run_id = excluded.run_id, fetched_at = excluded.fetched_at`);

    const save = sqlite.transaction((req: PlannedRequest, rows: NormalizedDetection[]) => {
      const now = new Date().toISOString();
      let inserted = 0;
      let updated = 0;
      for (const r of rows) {
        const c = classifyPoint(territory, r.latitude, r.longitude);
        if (!c.inCountry) continue;
        result.rowsInCountry++;
        const existed = !!exists.get(r.id);
        const info = upsert.run({ ...r, provinceId: c.provinceId, municipalityId: c.municipalityId, runId, now });
        if (!existed) inserted++;
        else if (info.changes) updated++;
      }
      coverage.run(req.source, req.dateFrom, req.dateTo, rows.length, runId, now);
      return { inserted, updated };
    });

    let abort = false;
    for (const [i, req] of requests.entries()) {
      if (abort) break;
      if (i > 0 && opts.delayMs) await sleep(opts.delayMs);
      result.requests++;
      log(`→ ${req.source} ${req.dateFrom}..${req.dateTo}`);
      try {
        const text = await fetchText(cfg, req.url, opts.fetchImpl);
        const parsed = parseFirmsCsv(text, req.source);
        result.rowsFetched += parsed.totalRows;
        result.rowsRejected += parsed.rejected;
        const before = result.rowsInCountry;
        const { inserted, updated } = save(req, parsed.records);
        result.rowsInserted += inserted;
        result.rowsUpdated += updated;
        log(`  ${parsed.totalRows} filas, ${result.rowsInCountry - before} en RD, ${inserted} nuevas, ${updated} actualizadas`);
      } catch (e) {
        const err = toFirmsError(e);
        const message = redact(err.message, cfg.mapKey);
        result.errors.push({ source: req.source, dateFrom: req.dateFrom, dateTo: req.dateTo, type: err.type, message });
        log(`  ✗ ${message}`);
        // Estos errores afectarían también al resto de las solicitudes.
        if (err.type === "auth" || err.type === "rate_limit" || err.type === "network") abort = true;
      }
    }

    if (result.errors.length) {
      const ok = result.requests - result.errors.filter((e) => e.source !== "*").length;
      result.status = ok > 0 ? "partial" : "failed";
    }
    const first = result.errors[0];
    sqlite
      .prepare(
        `UPDATE ingestion_runs SET status = ?, finished_at = ?, requests = ?, rows_fetched = ?, rows_in_country = ?,
         rows_inserted = ?, rows_updated = ?, rows_rejected = ?, error_type = ?, error_message = ? WHERE id = ?`,
      )
      .run(
        result.status === "nothing_to_do" ? "success" : result.status,
        new Date().toISOString(),
        result.requests,
        result.rowsFetched,
        result.rowsInCountry,
        result.rowsInserted,
        result.rowsUpdated,
        result.rowsRejected,
        first?.type ?? null,
        first ? `${first.message}${result.errors.length > 1 ? ` (+${result.errors.length - 1} errores)` : ""}` : null,
        runId,
      );
    return result;
  } catch (e) {
    if (runId !== undefined) {
      sqlite
        .prepare("UPDATE ingestion_runs SET status = 'failed', finished_at = ?, error_type = 'other', error_message = ? WHERE id = ?")
        .run(new Date().toISOString(), redact((e as Error).message, cfg.mapKey), runId);
    }
    throw e;
  } finally {
    releaseLock(db, SYNC_LOCK, owner);
  }
}
