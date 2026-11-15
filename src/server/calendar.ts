import type { DB } from "@/db/client";
import type { CalendarCell, CalendarMode, CalendarResponse, Calibration, RegionQuery } from "@/lib/types";
import type { EngineCalibration } from "./harmonize/calibrate";
import { type CellDetection, cellKey, emptyCounts, type MonthCounts, monthlyCounts } from "./harmonize/cells";
import { FIRST_YEAR, harmonizedSeries, VIIRS_START_YEAR, ymKey } from "./harmonize/series";
import { monthStats, withAnomaly } from "./harmonize/stats";
import { DEDUPE } from "./queries";
import { inAoi, parseAoi, regionKey } from "./region";

/** Primer año de la línea base de anomalías (evita los meses de un solo satélite, spec §5). */
export const BASELINE_START = 2003;

interface MonthRow {
  year: number;
  month: number;
  modis_raw: number;
  viirs_raw: number;
  modis_cd: number;
  viirs_cd: number;
  harmonized: number | null;
  single_satellite: number;
}

function readCalibration(db: DB, key: string): Calibration | null {
  const r = db.$client.prepare("SELECT * FROM calibration WHERE region_key = ?").get(key) as
    | { k: number; ci_lo: number; ci_hi: number; r2: number; k_terra: number; overlap_from: number; overlap_to: number; source: "region" | "country" }
    | undefined;
  return r ? { k: r.k, ci: [r.ci_lo, r.ci_hi], r2: r.r2, overlapYears: [r.overlap_from, r.overlap_to], kTerra: r.k_terra, source: r.source } : null;
}

const rawValue = (c: Pick<CalendarCell, "year" | "modis" | "viirs">) => (c.year < VIIRS_START_YEAR ? c.modis : c.viirs);

/** Celdas guardadas por la reconstrucción + conteos en celdas-día (para la validación). */
function storedRegion(db: DB, key: string, untilYear: number) {
  const rows = db.$client.prepare("SELECT * FROM harmonized_monthly WHERE region_key = ?").all(key) as MonthRow[];
  const byYm = new Map(rows.map((r) => [ymKey(r.year, r.month), r]));
  const cells: CalendarCell[] = [];
  const counts = new Map<string, Pick<MonthCounts, "modisCd" | "viirsCd">>();
  for (let year = FIRST_YEAR; year <= untilYear; year++)
    for (let month = 1; month <= 12; month++) {
      const r = byYm.get(ymKey(year, month));
      counts.set(ymKey(year, month), { modisCd: r?.modis_cd ?? 0, viirsCd: r?.viirs_cd ?? 0 });
      cells.push({
        year, month, modis: r?.modis_raw ?? 0, viirs: r?.viirs_raw ?? 0, harmonized: r ? r.harmonized : null,
        value: 0, anomaly: null, singleSatellite: ymKey(year, month) < "2002-07",
      });
    }
  return { cells, counts };
}

/** Área dibujada: se calcula al vuelo con el factor del país. */
function aoiRegion(db: DB, q: RegionQuery, countryCal: Calibration | null, untilYear: number) {
  const aoi = parseAoi(q.aoi!);
  const rows = db.$client
    .prepare(
      `SELECT latitude AS lat, longitude AS lon, acq_date AS acqDate,
         COALESCE(sensor_family, CASE WHEN instrument LIKE 'MODIS%' THEN 'MODIS' ELSE 'VIIRS' END) AS family,
         satellite, confidence, fire_type AS fireType
       FROM fire_detections d WHERE longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ? AND ${DEDUPE}`,
    )
    .all(aoi.bbox[0], aoi.bbox[2], aoi.bbox[1], aoi.bbox[3]) as CellDetection[];
  const inside = rows.filter((d) => inAoi(aoi, d.lat, d.lon));
  const fixed = new Set(inside.filter((d) => d.fireType === 2).map((d) => cellKey(d.lat, d.lon)));
  const m = monthlyCounts(inside.map((d) => ({ ...d, staticCell: d.fireType === null && fixed.has(cellKey(d.lat, d.lon)) })));
  const cal: Calibration | null = countryCal ? { ...countryCal, source: "country" } : null;
  const engine: EngineCalibration | null = cal ? { ...cal, kNoaa20: null } : null;
  const cells = engine
    ? harmonizedSeries(m, engine, untilYear)
    : harmonizedSeries(m, { k: 0, ci: [0, 0], r2: 0, overlapYears: [0, 0], kTerra: 0, kNoaa20: null, source: "country" }, untilYear).map((c) => ({ ...c, harmonized: null }));
  const counts = new Map([...m].map(([ym, c]) => [ym, { modisCd: c.modisCd, viirsCd: c.viirsCd }]));
  return { cells, counts, cal };
}

const inRange = (c: CalendarCell, from?: string, to?: string) => {
  const ym = ymKey(c.year, c.month);
  return (!from || ym >= from.slice(0, 7)) && (!to || ym <= to.slice(0, 7));
};

/** Calendario año × mes de la región en modo armonizado o crudo, con mediana, anomalías y validación del solape. */
export function getCalendar(db: DB, q: RegionQuery, mode: CalendarMode, now = new Date()): CalendarResponse {
  const nowYear = now.getUTCFullYear();
  const countryCal = readCalibration(db, q.iso3);
  const region = q.aoi
    ? aoiRegion(db, q, countryCal, nowYear)
    : (() => {
        const stored = storedRegion(db, regionKey(q), nowYear);
        const own = readCalibration(db, regionKey(q));
        return { ...stored, cal: own ?? (countryCal ? { ...countryCal, source: "country" as const } : null) };
      })();
  const valued = region.cells.map((c) => ({
    ...c,
    value: mode === "harmonized" && c.harmonized !== null ? c.harmonized : rawValue(c),
  }));
  const stats = monthStats(valued, [BASELINE_START, nowYear - 1]);
  const all = withAnomaly(valued, stats);
  // El mes en curso está incompleto (y FIRMS publica con retraso): se compara el último mes completo.
  const last = new Date(Date.UTC(nowYear, now.getUTCMonth() - 1, 1));
  const cur = all.find((c) => c.year === last.getUTCFullYear() && c.month === last.getUTCMonth() + 1);
  const median = cur ? stats[cur.month - 1].median : null;
  const k = region.cal?.k ?? null;
  const [o0, o1] = region.cal?.overlapYears ?? [0, -1];
  return {
    mode,
    region: q,
    cells: all.filter((c) => inRange(c, q.from, q.to)),
    monthStats: stats,
    calibration: region.cal,
    current: cur ? { year: cur.year, month: cur.month, value: cur.value, median, ratio: median ? cur.value / median : null } : null,
    validation:
      k === null
        ? []
        : all
            .filter((c) => c.year >= o0 && c.year <= o1)
            .map((c) => {
              const cd = region.counts.get(ymKey(c.year, c.month)) ?? emptyCounts();
              return { year: c.year, month: c.month, modisScaled: cd.modisCd * k, viirs: cd.viirsCd };
            }),
  };
}
