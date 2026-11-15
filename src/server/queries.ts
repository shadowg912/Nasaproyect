import type { DB } from "@/db/client";
import type { DetectionFilters, HistoryStats, Stats } from "@/lib/types";
import { isIsoDate } from "@/lib/dates";

/** Plataformas (familias de producto) usadas en los filtros de la interfaz. */
export const PLATFORMS: Record<string, string> = {
  NOAA20: "VIIRS_NOAA20_",
  NOAA21: "VIIRS_NOAA21_",
  SNPP: "VIIRS_SNPP_",
  MODIS: "MODIS_",
};

/**
 * Los productos NRT y SP describen las mismas observaciones. Cuando un día ya
 * está cubierto por el producto estándar (SP), se excluyen las filas NRT de ese
 * día para no contar dos veces el mismo fuego.
 */
const DEDUPE = `NOT (d.source LIKE '%\\_NRT' ESCAPE '\\' AND EXISTS (
  SELECT 1 FROM ingestion_coverage c WHERE c.source = replace(d.source, '_NRT', '_SP')
  AND d.acq_date BETWEEN c.date_from AND c.date_to))`;

export function parseFilters(sp: URLSearchParams): DetectionFilters {
  const list = (k: string) =>
    sp
      .getAll(k)
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);
  const f: DetectionFilters = {};
  const from = sp.get("from");
  const to = sp.get("to");
  if (isIsoDate(from)) f.from = from;
  if (isIsoDate(to)) f.to = to;
  const sats = list("satellite").filter((s) => s in PLATFORMS);
  if (sats.length) f.satellites = sats;
  const conf = list("confidence").filter((c): c is "low" | "nominal" | "high" => ["low", "nominal", "high"].includes(c));
  if (conf.length) f.confidence = conf;
  const prov = Number(sp.get("province"));
  if (Number.isInteger(prov) && prov > 0) f.provinceId = prov;
  const mun = Number(sp.get("municipality"));
  if (Number.isInteger(mun) && mun > 0) f.municipalityId = mun;
  const dn = sp.get("daynight");
  if (dn === "D" || dn === "N") f.daynight = dn;
  return f;
}

export function buildWhere(f: DetectionFilters) {
  const clauses = [DEDUPE];
  const params: (string | number)[] = [];
  if (f.from) (clauses.push("d.acq_date >= ?"), params.push(f.from));
  if (f.to) (clauses.push("d.acq_date <= ?"), params.push(f.to));
  if (f.satellites?.length) {
    clauses.push(`(${f.satellites.map(() => "d.source LIKE ?").join(" OR ")})`);
    params.push(...f.satellites.map((s) => `${PLATFORMS[s]}%`));
  }
  if (f.confidence?.length) {
    clauses.push(`d.confidence IN (${f.confidence.map(() => "?").join(",")})`);
    params.push(...f.confidence);
  }
  if (f.provinceId) (clauses.push("d.province_id = ?"), params.push(f.provinceId));
  if (f.municipalityId) (clauses.push("d.municipality_id = ?"), params.push(f.municipalityId));
  if (f.daynight) (clauses.push("d.daynight = ?"), params.push(f.daynight));
  return { sql: `WHERE ${clauses.join(" AND ")}`, params };
}

export interface DetectionRow {
  id: string;
  source: string;
  satellite: string;
  latitude: number;
  longitude: number;
  acquiredAt: string;
  acqDate: string;
  frp: number | null;
  brightness: number | null;
  confidence: string;
  daynight: string | null;
  province: string | null;
  municipality: string | null;
}

export function listDetections(db: DB, f: DetectionFilters, limit = 20000) {
  const w = buildWhere(f);
  const rows = db.$client
    .prepare(
      `SELECT d.id, d.source, d.satellite, d.latitude, d.longitude, d.acquired_at AS acquiredAt, d.acq_date AS acqDate,
        d.frp, d.brightness, d.confidence, d.daynight, p.name AS province, m.name AS municipality
       FROM fire_detections d LEFT JOIN provinces p ON p.id = d.province_id LEFT JOIN municipalities m ON m.id = d.municipality_id
       ${w.sql} ORDER BY d.acquired_at DESC LIMIT ?`,
    )
    .all(...w.params, limit + 1) as DetectionRow[];
  const truncated = rows.length > limit;
  return { rows: truncated ? rows.slice(0, limit) : rows, truncated };
}

export function toGeoJSON(rows: DetectionRow[]) {
  return {
    type: "FeatureCollection" as const,
    features: rows.map(({ latitude, longitude, ...props }) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [longitude, latitude] },
      properties: props,
    })),
  };
}

export function getStats(db: DB, f: DetectionFilters): Stats {
  const s = db.$client;
  const w = buildWhere(f);
  const q = <T>(sql: string) => s.prepare(sql).all(...w.params) as T[];
  const totals = s
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(d.frp),0) AS totalFrp, COUNT(DISTINCT d.province_id) AS provincesAffected,
        SUM(d.confidence = 'high') AS highConfidence FROM fire_detections d ${w.sql}`,
    )
    .get(...w.params) as { total: number; totalFrp: number; provincesAffected: number; highConfidence: number | null };
  return {
    filters: f,
    total: totals.total,
    totalFrp: Math.round(totals.totalFrp * 10) / 10,
    provincesAffected: totals.provincesAffected,
    highConfidence: totals.highConfidence ?? 0,
    byDay: q(`SELECT d.acq_date AS date, COUNT(*) AS count, ROUND(COALESCE(SUM(d.frp),0),1) AS frp FROM fire_detections d ${w.sql} GROUP BY d.acq_date ORDER BY d.acq_date`),
    byProvince: q(
      `SELECT d.province_id AS id, COALESCE(p.name, 'Sin asignar') AS name, COUNT(*) AS count, ROUND(COALESCE(SUM(d.frp),0),1) AS frp
       FROM fire_detections d LEFT JOIN provinces p ON p.id = d.province_id ${w.sql} GROUP BY d.province_id ORDER BY count DESC`,
    ),
    byConfidence: q(`SELECT d.confidence AS confidence, COUNT(*) AS count FROM fire_detections d ${w.sql} GROUP BY d.confidence`),
    bySatellite: q(`SELECT d.satellite AS satellite, COUNT(*) AS count FROM fire_detections d ${w.sql} GROUP BY d.satellite ORDER BY count DESC`),
    byDaynight: q(`SELECT COALESCE(d.daynight,'?') AS daynight, COUNT(*) AS count FROM fire_detections d ${w.sql} GROUP BY d.daynight`),
  };
}

export function getHistory(db: DB, f: DetectionFilters): HistoryStats {
  const s = db.$client;
  const w = buildWhere(f);
  const q = <T>(sql: string) => s.prepare(sql).all(...w.params) as T[];
  return {
    byMonth: q(`SELECT substr(d.acq_date,1,7) AS month, COUNT(*) AS count, ROUND(COALESCE(SUM(d.frp),0),1) AS frp FROM fire_detections d ${w.sql} GROUP BY month ORDER BY month`),
    byYear: q(`SELECT substr(d.acq_date,1,4) AS year, COUNT(*) AS count FROM fire_detections d ${w.sql} GROUP BY year ORDER BY year`),
    monthOfYear: q(
      `SELECT CAST(substr(d.acq_date,6,2) AS INTEGER) AS month, COUNT(*) AS count, COUNT(DISTINCT substr(d.acq_date,1,4)) AS years
       FROM fire_detections d ${w.sql} GROUP BY month ORDER BY month`,
    ),
    topMunicipalities: q(
      `SELECT m.id AS id, m.name AS name, p.name AS province, COUNT(*) AS count FROM fire_detections d
       JOIN municipalities m ON m.id = d.municipality_id LEFT JOIN provinces p ON p.id = m.province_id
       ${w.sql} GROUP BY m.id ORDER BY count DESC LIMIT 15`,
    ),
    coverage: s
      .prepare(
        "SELECT source, date_from AS dateFrom, date_to AS dateTo, row_count AS rowCount FROM ingestion_coverage ORDER BY source, date_from",
      )
      .all() as HistoryStats["coverage"],
  };
}

export function listTerritory(db: DB) {
  const provinces = db.$client.prepare("SELECT id, code, name, area_km2 AS areaKm2 FROM provinces ORDER BY name").all();
  const municipalities = db.$client
    .prepare("SELECT id, code, name, province_id AS provinceId FROM municipalities ORDER BY name")
    .all();
  return { provinces, municipalities };
}

export function listRuns(db: DB, limit = 20) {
  return db.$client
    .prepare(
      `SELECT id, kind, trigger, status, sources, date_from AS dateFrom, date_to AS dateTo, started_at AS startedAt,
        finished_at AS finishedAt, requests, rows_fetched AS rowsFetched, rows_in_country AS rowsInCountry,
        rows_inserted AS rowsInserted, rows_updated AS rowsUpdated, rows_rejected AS rowsRejected,
        error_type AS errorType, error_message AS errorMessage
       FROM ingestion_runs ORDER BY started_at DESC, id DESC LIMIT ?`,
    )
    .all(limit);
}
