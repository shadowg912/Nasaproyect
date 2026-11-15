import type { DB } from "@/db/client";
import type { RegionQuery } from "@/lib/types";
import { getCalendar } from "./calendar";
import { DEDUPE } from "./queries";
import { inAoi, parseAoi } from "./region";

/** Máximo de focos por descarga (protege la memoria del servidor). */
export const MAX_EXPORT_ROWS = 200_000;

const cell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvRow = (values: (string | number | null | undefined)[]) => values.map(cell).join(",");

const FIRE_TYPE: Record<number, string> = { 0: "vegetacion", 1: "volcan", 2: "fuente_fija", 3: "costa_afuera" };

interface DetRow {
  acq_date: string;
  acq_time: string;
  latitude: number;
  longitude: number;
  sensor_family: string | null;
  satellite: string;
  confidence: string;
  frp: number | null;
  fire_type: number | null;
  province: string | null;
  municipality: string | null;
}

function detectionsCsv(db: DB, q: RegionQuery): string {
  const where = [DEDUPE];
  const params: (string | number)[] = [];
  const aoi = q.aoi ? parseAoi(q.aoi) : null;
  if (aoi) {
    where.push("d.longitude BETWEEN ? AND ? AND d.latitude BETWEEN ? AND ?");
    params.push(aoi.bbox[0], aoi.bbox[2], aoi.bbox[1], aoi.bbox[3]);
  } else {
    where.push("d.country_iso3 = ?");
    params.push(q.iso3);
    if (q.provinceId) (where.push("d.province_id = ?"), params.push(q.provinceId));
    if (q.municipalityId) (where.push("d.municipality_id = ?"), params.push(q.municipalityId));
  }
  if (q.from) (where.push("d.acq_date >= ?"), params.push(q.from));
  if (q.to) (where.push("d.acq_date <= ?"), params.push(q.to));
  const rows = db.$client
    .prepare(
      `SELECT d.acq_date, d.acq_time, d.latitude, d.longitude, d.sensor_family, d.satellite, d.confidence, d.frp, d.fire_type,
         p.name AS province, m.name AS municipality
       FROM fire_detections d LEFT JOIN provinces p ON p.id = d.province_id LEFT JOIN municipalities m ON m.id = d.municipality_id
       WHERE ${where.join(" AND ")} ORDER BY d.acquired_at LIMIT ?`,
    )
    .all(...params, MAX_EXPORT_ROWS) as DetRow[];
  const header = "fecha,hora_utc,latitud,longitud,sensor,satelite,confianza,frp,tipo,provincia,municipio";
  const lines = rows
    .filter((r) => !aoi || inAoi(aoi, r.latitude, r.longitude))
    .map((r) =>
      csvRow([
        r.acq_date, `${r.acq_time.slice(0, 2)}:${r.acq_time.slice(2)}`, r.latitude, r.longitude, r.sensor_family, r.satellite,
        r.confidence, r.frp, r.fire_type === null ? null : FIRE_TYPE[r.fire_type], r.province, r.municipality,
      ]),
    );
  return [header, ...lines].join("\n") + "\n";
}

function monthlyCsv(db: DB, q: RegionQuery, now: Date): string {
  const cal = getCalendar(db, q, "harmonized", now);
  const round = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
  const lines = cal.cells.map((c) => csvRow([c.year, c.month, c.modis, c.viirs, round(c.harmonized), round(c.anomaly)]));
  return ["anio,mes,modis_crudo,viirs_crudo,armonizado,anomalia", ...lines].join("\n") + "\n";
}

/** CSV descargable de la búsqueda: focos individuales o la tabla mensual armonizada. */
export function exportCsv(db: DB, q: RegionQuery, kind: "detections" | "monthly", now = new Date()): string {
  return kind === "monthly" ? monthlyCsv(db, q, now) : detectionsCsv(db, q);
}

export const exportFilename = (q: RegionQuery, kind: string) => {
  const region = q.aoi ? "area" : q.municipalityId ? `${q.iso3}-m${q.municipalityId}` : q.provinceId ? `${q.iso3}-p${q.provinceId}` : q.iso3;
  return `satflame-${region}-${kind === "monthly" ? "mensual" : "focos"}-${q.from ?? "inicio"}-${q.to ?? "hoy"}.csv`;
};
